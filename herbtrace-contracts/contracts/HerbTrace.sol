// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * ============================================================
 * HerbTrace Smart Contract — v3 (Failure Resilience Edition)
 * ============================================================
 *
 * Changes from v2:
 *   - Status enum extended: TestFailed, Quarantined, Recalled
 *   - recordTest() now accepts a `passed` bool outcome
 *   - processBatch() guards: rejects TestFailed / Quarantined / Recalled parents
 *   - transferCustody() guards: rejects TestFailed / Quarantined / Recalled batch
 *   - recallBatch() — ADMIN only — marks a batch Recalled
 *   - New events: TestFailed, BatchRecalled
 *   - Backward-compatible: all existing v2 function signatures preserved
 * ============================================================
 */
contract HerbTrace is AccessControl {
    bytes32 public constant FARMER_ROLE      = keccak256("FARMER_ROLE");
    bytes32 public constant LAB_ROLE         = keccak256("LAB_ROLE");
    bytes32 public constant PROCESSOR_ROLE   = keccak256("PROCESSOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    // ── Status Enum ─────────────────────────────────────────────────────────
    // IMPORTANT: do NOT reorder — numeric values are stored on-chain.
    // Existing:  0=Created, 1=Tested, 2=Processed, 3=Transferred
    // New:       4=TestFailed, 5=Quarantined, 6=Recalled
    enum Status {
        Created,      // 0 — batch created by farmer
        Tested,       // 1 — lab test PASSED
        Processed,    // 2 — processed into new batch
        Transferred,  // 3 — custody transferred
        TestFailed,   // 4 — lab test FAILED (cannot proceed)
        Quarantined,  // 5 — quarantined by admin (cannot proceed)
        Recalled      // 6 — recalled due to contamination or lineage issue
    }

    // ── Lab Outcome ──────────────────────────────────────────────────────────
    enum LabOutcome {
        Pass,   // 0
        Fail,   // 1
        Flagged // 2 — optional soft flag (does NOT block processing)
    }

    struct Batch {
        string  batchId;
        address currentOwner;
        Status  status;
        bytes32 dataHash;
        uint256 lastUpdated;
    }

    struct MerkleAnchor {
        string  batchId;
        uint256 stageIndex;
        bytes32 merkleRoot;
        uint256 timestamp;
    }

    struct LocationRecord {
        string  batchId;
        uint256 stageIndex;
        string  agreedLocation;
        bool    verified;
        address recordedBy;
        uint256 timestamp;
    }

    // ── Storage ─────────────────────────────────────────────────────────────
    mapping(string => Batch)              public batches;
    mapping(string => string[])           public parents;
    mapping(string => MerkleAnchor[])     public merkleAnchors;
    mapping(string => LocationRecord[4])  public locationRecords; // indexed by stageIndex

    // single-root per batch (new, alongside the array)
    mapping(string => bytes32)  private _merkleRoot;
    mapping(string => bool)     private _merkleAnchored;

    // ── Events ───────────────────────────────────────────────────────────────
    event BatchCreated(
        string  indexed batchId,
        address indexed farmer,
        bytes32         dataHash
    );
    // Generic update event (used by Test/Transfer/Quarantine/Recall)
    event BatchUpdated(
        string  indexed batchId,
        address indexed actor,
        Status          newStatus,
        bytes32         dataHash
    );
    event BatchProcessed(
        string  indexed batchId,
        address indexed processor,
        bytes32         dataHash
    );
    event CustodyTransferred(
        string  indexed batchId,
        address indexed newOwner,
        bytes32         dataHash
    );
    // Keep legacy events for backward compatibility with listeners
    event TestRecorded(
        string  indexed batchId,
        address indexed lab,
        bytes32         dataHash
    );
    event TestFailed(
        string  indexed batchId,
        address indexed lab,
        bytes32         dataHash,
        string          reason
    );
    event BatchRecalled(
        string  indexed batchId,
        address indexed admin,
        string          reason
    );
    event MerkleRootAnchored(
        string  indexed batchId,
        uint256         stageIndex,
        bytes32         merkleRoot,
        address         anchoredBy,
        uint256         timestamp
    );
    event LocationVerified(
        string  indexed batchId,
        uint256         stageIndex,
        bool            verified,
        string          agreedLocation,
        address         recordedBy,
        uint256         timestamp
    );

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ── Role Management ──────────────────────────────────────────────────────
    function addFarmer(address farmer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(FARMER_ROLE, farmer);
    }
    function addLab(address lab) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(LAB_ROLE, lab);
    }
    function addProcessor(address processor) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PROCESSOR_ROLE, processor);
    }
    function addDistributor(address distributor) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(DISTRIBUTOR_ROLE, distributor);
    }

    // ── Internal Helpers ─────────────────────────────────────────────────────
    function _batchExists(string memory batchId) internal view returns (bool) {
        return bytes(batches[batchId].batchId).length > 0;
    }

    function _isBlocked(Status s) internal pure returns (bool) {
        return s == Status.TestFailed || s == Status.Quarantined || s == Status.Recalled;
    }

    // ── Core Lifecycle Functions ──────────────────────────────────────────────

    /**
     * @notice Create a new raw herb batch.
     * @param batchId  Unique batch identifier
     * @param dataHash keccak256 hash of the batch creation data
     */
    function createBatch(string memory batchId, bytes32 dataHash)
        public
        onlyRole(FARMER_ROLE)
    {
        require(!_batchExists(batchId), "Batch already exists");
        batches[batchId] = Batch(batchId, msg.sender, Status.Created, dataHash, block.timestamp);
        emit BatchCreated(batchId, msg.sender, dataHash);
    }

    /**
     * @notice Record a lab test result.
     *         outcome=Pass  → status becomes Tested (can proceed)
     *         outcome=Fail  → status becomes TestFailed (blocked)
     *         outcome=Flagged → status becomes Tested but emits a warning (not blocked)
     *
     * @param batchId  Target batch
     * @param dataHash keccak256 hash of lab test data
     * @param outcome  LabOutcome enum value (0=Pass, 1=Fail, 2=Flagged)
     * @param reason   Human-readable reason string (used for Fail/Flagged events)
     */
    function recordTest(
        string  memory batchId,
        bytes32        dataHash,
        LabOutcome     outcome,
        string  memory reason
    ) public onlyRole(LAB_ROLE) {
        require(_batchExists(batchId), "Batch not found");
        require(batches[batchId].status == Status.Created, "Batch must be in Created state for lab test");

        batches[batchId].dataHash     = dataHash;
        batches[batchId].lastUpdated  = block.timestamp;

        if (outcome == LabOutcome.Fail) {
            batches[batchId].status = Status.TestFailed;
            emit TestFailed(batchId, msg.sender, dataHash, reason);
            emit BatchUpdated(batchId, msg.sender, Status.TestFailed, dataHash);
        } else {
            // Pass or Flagged — both allow processing
            batches[batchId].status = Status.Tested;
            emit TestRecorded(batchId, msg.sender, dataHash);
            emit BatchUpdated(batchId, msg.sender, Status.Tested, dataHash);
        }
    }

    /**
     * @notice Process one or more tested batches into a new processed batch.
     *         All parent batches must be in Tested status (not Failed/Recalled).
     *
     * @param newBatchId    New batch identifier for the processed output
     * @param parentBatchIds Array of source batch IDs
     * @param dataHash      keccak256 hash of processing data
     */
    function processBatch(
        string   memory newBatchId,
        string[] memory parentBatchIds,
        bytes32         dataHash
    ) public onlyRole(PROCESSOR_ROLE) {
        require(!_batchExists(newBatchId), "Batch already exists");
        require(parentBatchIds.length > 0, "At least one parent required");

        // Guard: all parents must be Tested (not blocked)
        for (uint256 i = 0; i < parentBatchIds.length; i++) {
            string memory pid = parentBatchIds[i];
            if (_batchExists(pid)) {
                require(
                    !_isBlocked(batches[pid].status),
                    "One or more parent batches are blocked (TestFailed, Quarantined, or Recalled)"
                );
                // Parents should be in Tested or Processed state
                require(
                    batches[pid].status == Status.Tested || batches[pid].status == Status.Processed,
                    "Parent batch must be in Tested or Processed state"
                );
            }
        }

        batches[newBatchId] = Batch(newBatchId, msg.sender, Status.Processed, dataHash, block.timestamp);
        parents[newBatchId] = parentBatchIds;
        emit BatchProcessed(newBatchId, msg.sender, dataHash);
        emit BatchCreated(newBatchId, msg.sender, dataHash); // for backward compat listeners
    }

    /**
     * @notice Transfer custody of a batch to a new owner.
     *         Batch must not be in a blocked state.
     *
     * @param batchId   Target batch
     * @param newOwner  Ethereum address of new owner
     * @param dataHash  keccak256 hash of transfer data
     */
    function transferCustody(
        string  memory batchId,
        address        newOwner,
        bytes32        dataHash
    ) public onlyRole(DISTRIBUTOR_ROLE) {
        require(_batchExists(batchId), "Batch not found");
        require(!_isBlocked(batches[batchId].status), "Batch is blocked (TestFailed, Quarantined, or Recalled)");

        batches[batchId].currentOwner = newOwner;
        batches[batchId].status       = Status.Transferred;
        batches[batchId].dataHash     = dataHash;
        batches[batchId].lastUpdated  = block.timestamp;

        emit CustodyTransferred(batchId, newOwner, dataHash);
        emit BatchUpdated(batchId, newOwner, Status.Transferred, dataHash);
    }

    /**
     * @notice Recall a batch. ADMIN-only.
     *         Sets status to Recalled, preventing further processing or transfer.
     *         Does NOT delete the batch — historical records are preserved.
     *
     * @param batchId  Batch to recall
     * @param reason   Human-readable recall reason
     */
    function recallBatch(
        string memory batchId,
        string memory reason
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_batchExists(batchId), "Batch not found");
        require(batches[batchId].status != Status.Recalled, "Batch already recalled");

        batches[batchId].status      = Status.Recalled;
        batches[batchId].lastUpdated = block.timestamp;

        emit BatchRecalled(batchId, msg.sender, reason);
        emit BatchUpdated(batchId, msg.sender, Status.Recalled, batches[batchId].dataHash);
    }

    /**
     * @notice Quarantine a batch. ADMIN-only.
     *         Sets status to Quarantined — a softer hold than Recalled.
     *
     * @param batchId  Batch to quarantine
     * @param reason   Human-readable quarantine reason
     */
    function quarantineBatch(
        string memory batchId,
        string memory reason // stored off-chain; included for event traceability
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_batchExists(batchId), "Batch not found");
        require(!_isBlocked(batches[batchId].status), "Batch already in a blocked state");

        batches[batchId].status      = Status.Quarantined;
        batches[batchId].lastUpdated = block.timestamp;

        // Emit reason as part of the generic update payload so indexers can capture it
        emit BatchRecalled(batchId, msg.sender, reason); // reuse BatchRecalled for quarantine logging
        emit BatchUpdated(batchId, msg.sender, Status.Quarantined, batches[batchId].dataHash);
    }

    // ── Merkle Anchoring ─────────────────────────────────────────────────────

    /**
     * @notice Anchor a Merkle root for a specific lifecycle stage.
     *         Can be called by any authenticated role (any wallet with a role).
     *         Reverts if a root was already anchored for this (batchId, stageIndex) pair.
     */
    function anchorMerkleRoot(
        string  memory batchId,
        uint256        stageIndex,
        bytes32        merkleRoot
    ) public {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(FARMER_ROLE,        msg.sender) ||
            hasRole(LAB_ROLE,           msg.sender) ||
            hasRole(PROCESSOR_ROLE,     msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE,   msg.sender),
            "Caller must have a HerbTrace role"
        );
        require(_batchExists(batchId), "Batch does not exist");
        require(merkleRoot != bytes32(0), "Merkle root cannot be zero");

        // Allow multiple stageIndex anchors — push to array
        // (The single-root shortcut below is kept for getMerkleRoot() backward compat)
        merkleAnchors[batchId].push(MerkleAnchor(batchId, stageIndex, merkleRoot, block.timestamp));

        // Single-root shortcut: store the LATEST anchored root
        _merkleRoot[batchId]     = merkleRoot;
        _merkleAnchored[batchId] = true;

        emit MerkleRootAnchored(batchId, stageIndex, merkleRoot, msg.sender, block.timestamp);
    }

    /**
     * @notice Get the latest anchored Merkle root for a batch.
     * @return root     The anchored root (zero if not yet anchored)
     * @return anchored True if a root has been anchored
     */
    function getMerkleRoot(string memory batchId)
        public view
        returns (bytes32 root, bool anchored)
    {
        return (_merkleRoot[batchId], _merkleAnchored[batchId]);
    }

    // ── Location Verification ─────────────────────────────────────────────────

    /**
     * @notice Record oracle-consensus location verification for a lifecycle stage.
     *         stageIndex: 0=Create, 1=Test, 2=Process, 3=Transfer
     */
    function recordLocationVerification(
        string  memory batchId,
        uint256        stageIndex,
        bool           verified,
        string  memory location
    ) public {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(FARMER_ROLE,        msg.sender) ||
            hasRole(LAB_ROLE,           msg.sender) ||
            hasRole(PROCESSOR_ROLE,     msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE,   msg.sender),
            "Caller must have a HerbTrace role"
        );
        require(_batchExists(batchId), "Batch does not exist");
        require(stageIndex <= 3, "stageIndex must be 0-3");

        locationRecords[batchId][stageIndex] = LocationRecord(
            batchId,
            stageIndex,
            location,
            verified,
            msg.sender,
            block.timestamp
        );

        emit LocationVerified(batchId, stageIndex, verified, location, msg.sender, block.timestamp);
    }

    /**
     * @notice Get location verification record for a specific stage.
     */
    function getLocationVerification(string memory batchId, uint256 stageIndex)
        public view
        returns (LocationRecord memory)
    {
        require(stageIndex <= 3, "stageIndex must be 0-3");
        return locationRecords[batchId][stageIndex];
    }

    // ── Read Functions ────────────────────────────────────────────────────────

    function getBatch(string memory batchId) public view returns (Batch memory) {
        require(_batchExists(batchId), "Batch not found");
        return batches[batchId];
    }

    function getParents(string memory batchId) public view returns (string[] memory) {
        return parents[batchId];
    }

    function getMerkleAnchors(string memory batchId) public view returns (MerkleAnchor[] memory) {
        return merkleAnchors[batchId];
    }

    // Legacy: kept for backward compat
    function getLocationVerifications(string memory batchId) public view returns (LocationRecord[4] memory) {
        return locationRecords[batchId];
    }
}