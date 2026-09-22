# 03. Smart Contract Documentation

## 1. Contract Name
`HerbTrace`

## 2. Solidity Version
`^0.8.0` (Compiled with `0.8.27` as per `hardhat.config.js`)

## 3. State Variables
- `bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");`
- `bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");`
- `bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");`
- `bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");`

## 4. Structs
- `Batch`:
  - `string batchId`
  - `address currentOwner`
  - `Status status`
  - `bytes32 dataHash`
  - `uint256 lastUpdated`
- `MerkleAnchor`:
  - `string batchId`
  - `uint256 stageIndex`
  - `bytes32 merkleRoot`
  - `uint256 timestamp`
- `LocationConsensus`:
  - `string batchId`
  - `uint256 stageIndex`
  - `string typedLocation`
  - `bool verified`
  - `uint256 timestamp`

## 5. Enums
- `Status { Created, Tested, Processed, Transferred }`

## 6. Mappings
- `mapping(string => Batch) public batches;`
- `mapping(string => string[]) public parents;`
- `mapping(string => MerkleAnchor[]) public merkleAnchors;`
- `mapping(string => LocationConsensus[]) public locationVerifications;`

## 7. Arrays
None explicitly defined at the top level, but used as values in mappings (e.g., `string[]`, `MerkleAnchor[]`, `LocationConsensus[]`).

## 8. Events
- `BatchCreated(string indexed batchId, address indexed farmer, bytes32 dataHash)`
- `TestRecorded(string indexed batchId, address indexed lab, bytes32 dataHash)`
- `BatchProcessed(string indexed batchId, address indexed processor, bytes32 dataHash)`
- `CustodyTransferred(string indexed batchId, address indexed newOwner, bytes32 dataHash)`
- `MerkleRootAnchored(string indexed batchId, uint256 stageIndex, bytes32 merkleRoot)`
- `LocationVerified(string indexed batchId, uint256 stageIndex, bool verified, string location)`

## 9. Modifiers
Only OpenZeppelin's built-in `onlyRole(bytes32)` modifier is used.

## 10. Public/External Functions

### `createBatch`
- **Purpose:** Initiates a new batch on-chain.
- **Inputs:** `string memory batchId, bytes32 dataHash`
- **Outputs:** None
- **State changes:** Creates a new `Batch` in `batches` mapping.
- **Events emitted:** `BatchCreated`
- **Who can call it:** `FARMER_ROLE`
- **How it contributes to traceability:** Anchors the initial existence and data hash of a batch.

### `recordTest`
- **Purpose:** Updates batch status to Tested and stores the new data hash.
- **Inputs:** `string memory batchId, bytes32 dataHash`
- **Outputs:** None
- **State changes:** Updates `dataHash`, `status`, and `lastUpdated` of an existing `Batch`.
- **Events emitted:** `TestRecorded`
- **Who can call it:** `LAB_ROLE`
- **How it contributes to traceability:** Proves lab testing occurred with untampered data.

### `processBatch`
- **Purpose:** Creates a new processed batch and links it to its parents.
- **Inputs:** `string memory newBatchId, string[] memory parentBatchIds, bytes32 dataHash`
- **Outputs:** None
- **State changes:** Creates a new `Batch` and maps it to `parentBatchIds` in the `parents` mapping.
- **Events emitted:** `BatchProcessed`
- **Who can call it:** `PROCESSOR_ROLE`
- **How it contributes to traceability:** Establishes on-chain batch lineage and composition.

### `transferCustody`
- **Purpose:** Transfers ownership to a distributor.
- **Inputs:** `string memory batchId, address newOwner, bytes32 dataHash`
- **Outputs:** None
- **State changes:** Updates `currentOwner`, `status`, `dataHash`, and `lastUpdated`.
- **Events emitted:** `CustodyTransferred`
- **Who can call it:** `DISTRIBUTOR_ROLE`
- **How it contributes to traceability:** Tracks the chain of custody.

### `anchorMerkleRoot`
- **Purpose:** Anchors the Merkle root of the off-chain data tree.
- **Inputs:** `string memory batchId, uint256 stageIndex, bytes32 merkleRoot`
- **Outputs:** None
- **State changes:** Appends to the `merkleAnchors` mapping array.
- **Events emitted:** `MerkleRootAnchored`
- **Who can call it:** `DEFAULT_ADMIN_ROLE` (called by the backend).
- **How it contributes to traceability:** Allows off-chain verification of all 4 stages using a single 32-byte on-chain anchor.

### `recordLocationVerification`
- **Purpose:** Stores the consensus result of the multi-oracle location verification.
- **Inputs:** `string memory batchId, uint256 stageIndex, bool verified, string memory location`
- **Outputs:** None
- **State changes:** Appends to the `locationVerifications` mapping array.
- **Events emitted:** `LocationVerified`
- **Who can call it:** `DEFAULT_ADMIN_ROLE` (called by the backend).
- **How it contributes to traceability:** Provides immutable proof of geospatial verification.

## 11. View/Pure Functions
- `getBatch(string memory batchId)`
- `getParents(string memory batchId)`
- `getMerkleAnchors(string memory batchId)`
- `getLocationVerifications(string memory batchId)`

## 12. Access-Control Mechanisms
OpenZeppelin's `AccessControl` is utilized. The deployer receives `DEFAULT_ADMIN_ROLE` and grants specific roles (`addFarmer`, `addLab`, `addProcessor`, `addDistributor`).

## 13. Batch-Related Structures
The `Batch` struct contains `batchId`, but notably **does not contain a `chainId`**. `chainId` logic is implemented entirely off-chain in the backend `Batch.js` model.

## 14. Parent-Child Relationships
Maintained via the `parents` mapping: `mapping(string => string[]) public parents;`.

## 15. Merkle-Related Structures
The `MerkleAnchor` struct holds the `merkleRoot`.

## 16. Location-Verification-Related Structures
The `LocationConsensus` struct holds the boolean `verified` status and the `typedLocation`.

> [!IMPORTANT]
> **Verification of `chainId`:** `chainId` DOES NOT exist on-chain. It is an off-chain MongoDB construct used to thread the Merkle tree across stage transitions.
