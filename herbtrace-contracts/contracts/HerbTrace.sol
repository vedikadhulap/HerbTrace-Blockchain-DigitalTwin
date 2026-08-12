// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract HerbTrace is AccessControl {

    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

enum Status {
    Collected,
    Tested,
    Processed,
    Packaged,
    Distributed
}
struct Batch {
    string batchId;
    address currentOwner;
    Status status;
    bytes32 dataHash;
    uint256 lastUpdated;
}
// Stores all batches using batchId as the key
mapping(string => Batch) public batches;

// Stores parent-child relationships between batches
mapping(string => string[]) public batchParents;

event BatchCreated(
    string batchId,
    address farmer,
    bytes32 dataHash
);

event BatchUpdated(
    string batchId,
    Status newStatus,
    address updatedBy,
    bytes32 dataHash
);

event BatchLinked(
    string childBatchId,
    string parentBatchId
);

constructor() {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
}

// Admin assigns roles to users

function addFarmer(address wallet)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
{
    _grantRole(FARMER_ROLE, wallet);
}

function addLab(address wallet)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
{
    _grantRole(LAB_ROLE, wallet);
}

function addProcessor(address wallet)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
{
    _grantRole(PROCESSOR_ROLE, wallet);
}

function addDistributor(address wallet)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
{
    _grantRole(DISTRIBUTOR_ROLE, wallet);
}

// Step 1: Farmer creates a new batch at collection
function createBatch(
    string memory batchId,
    bytes32 dataHash
)
    external
    onlyRole(FARMER_ROLE)
{
    require(
        batches[batchId].lastUpdated == 0,
        "Batch already exists"
    );

    batches[batchId] = Batch(
        batchId,
        msg.sender,
        Status.Collected,
        dataHash,
        block.timestamp
    );

    emit BatchCreated(
        batchId,
        msg.sender,
        dataHash
    );
}

// Step 2: Lab records test result
function recordTest(
    string memory batchId,
    bytes32 dataHash
)
    external
    onlyRole(LAB_ROLE)
{
    require(
        batches[batchId].lastUpdated != 0,
        "Batch does not exist"
    );

    batches[batchId].status = Status.Tested;
    batches[batchId].dataHash = dataHash;
    batches[batchId].lastUpdated = block.timestamp;

    emit BatchUpdated(
        batchId,
        Status.Tested,
        msg.sender,
        dataHash
    );
}

    // Step 3: Processor creates a new output batch from one or more input batches
    function processBatch(
        string memory newBatchId,
        string[] memory parentBatchIds,
        bytes32 dataHash
    ) external onlyRole(PROCESSOR_ROLE) {
        batches[newBatchId] = Batch(newBatchId, msg.sender, Status.Processed, dataHash, block.timestamp);
        for (uint i = 0; i < parentBatchIds.length; i++) {
            batchParents[newBatchId].push(parentBatchIds[i]);
            emit BatchLinked(newBatchId, parentBatchIds[i]);
        }
        emit BatchCreated(newBatchId, msg.sender, dataHash);
    }

    // Step 4: Distributor takes custody
    function transferCustody(string memory batchId, address newOwner, bytes32 dataHash) external onlyRole(DISTRIBUTOR_ROLE) {
        batches[batchId].currentOwner = newOwner;
        batches[batchId].status = Status.Distributed;
        batches[batchId].dataHash = dataHash;
        batches[batchId].lastUpdated = block.timestamp;
        emit BatchUpdated(batchId, Status.Distributed, msg.sender, dataHash);
    }

    // Anyone can read a batch's on-chain proof — this is what the consumer QR page calls
    function getBatch(string memory batchId) external view returns (Batch memory) {
        return batches[batchId];
    }

    function getParents(string memory batchId) external view returns (string[] memory) {
        return batchParents[batchId];
    }
}