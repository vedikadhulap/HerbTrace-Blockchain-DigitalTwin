// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract HerbTrace is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    enum Status { Created, Tested, Processed, Transferred }

    struct Batch {
        string batchId;
        address currentOwner;
        Status status;
        bytes32 dataHash;
        uint256 lastUpdated;
    }

    struct MerkleAnchor {
        string batchId;
        uint256 stageIndex;
        bytes32 merkleRoot;
        uint256 timestamp;
    }

    struct LocationConsensus {
        string batchId;
        uint256 stageIndex;
        string typedLocation;
        bool verified;
        uint256 timestamp;
    }

    mapping(string => Batch) public batches;
    mapping(string => string[]) public parents;
    mapping(string => MerkleAnchor[]) public merkleAnchors;
    mapping(string => LocationConsensus[]) public locationVerifications;

    event BatchCreated(string indexed batchId, address indexed farmer, bytes32 dataHash);
    event TestRecorded(string indexed batchId, address indexed lab, bytes32 dataHash);
    event BatchProcessed(string indexed batchId, address indexed processor, bytes32 dataHash);
    event CustodyTransferred(string indexed batchId, address indexed newOwner, bytes32 dataHash);
    event MerkleRootAnchored(string indexed batchId, uint256 stageIndex, bytes32 merkleRoot);
    event LocationVerified(string indexed batchId, uint256 stageIndex, bool verified, string location);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

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

    function createBatch(string memory batchId, bytes32 dataHash) public onlyRole(FARMER_ROLE) {
        require(bytes(batches[batchId].batchId).length == 0, "Batch already exists");
        batches[batchId] = Batch(batchId, msg.sender, Status.Created, dataHash, block.timestamp);
        emit BatchCreated(batchId, msg.sender, dataHash);
    }

    function recordTest(string memory batchId, bytes32 dataHash) public onlyRole(LAB_ROLE) {
        require(bytes(batches[batchId].batchId).length > 0, "Batch not found");
        batches[batchId].dataHash = dataHash;
        batches[batchId].status = Status.Tested;
        batches[batchId].lastUpdated = block.timestamp;
        emit TestRecorded(batchId, msg.sender, dataHash);
    }

    function processBatch(string memory newBatchId, string[] memory parentBatchIds, bytes32 dataHash) public onlyRole(PROCESSOR_ROLE) {
        require(bytes(batches[newBatchId].batchId).length == 0, "Batch already exists");
        batches[newBatchId] = Batch(newBatchId, msg.sender, Status.Processed, dataHash, block.timestamp);
        parents[newBatchId] = parentBatchIds;
        emit BatchProcessed(newBatchId, msg.sender, dataHash);
    }

    function transferCustody(string memory batchId, address newOwner, bytes32 dataHash) public onlyRole(DISTRIBUTOR_ROLE) {
        require(bytes(batches[batchId].batchId).length > 0, "Batch not found");
        batches[batchId].currentOwner = newOwner;
        batches[batchId].status = Status.Transferred;
        batches[batchId].dataHash = dataHash;
        batches[batchId].lastUpdated = block.timestamp;
        emit CustodyTransferred(batchId, newOwner, dataHash);
    }

    function anchorMerkleRoot(string memory batchId, uint256 stageIndex, bytes32 merkleRoot) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(batches[batchId].batchId).length > 0, "Batch not found");
        merkleAnchors[batchId].push(MerkleAnchor(batchId, stageIndex, merkleRoot, block.timestamp));
        emit MerkleRootAnchored(batchId, stageIndex, merkleRoot);
    }

    function recordLocationVerification(string memory batchId, uint256 stageIndex, bool verified, string memory location) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(batches[batchId].batchId).length > 0, "Batch not found");
        locationVerifications[batchId].push(LocationConsensus(batchId, stageIndex, location, verified, block.timestamp));
        emit LocationVerified(batchId, stageIndex, verified, location);
    }

    function getBatch(string memory batchId) public view returns (Batch memory) {
        require(bytes(batches[batchId].batchId).length > 0, "Batch not found");
        return batches[batchId];
    }

    function getParents(string memory batchId) public view returns (string[] memory) {
        return parents[batchId];
    }

    function getMerkleAnchors(string memory batchId) public view returns (MerkleAnchor[] memory) {
        return merkleAnchors[batchId];
    }

    function getLocationVerifications(string memory batchId) public view returns (LocationConsensus[] memory) {
        return locationVerifications[batchId];
    }
}