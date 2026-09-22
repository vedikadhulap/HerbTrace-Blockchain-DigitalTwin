# 07. Merkle Tree / Data Integrity

## 1. Why Merkle Trees are Used
Merkle trees are used to ensure data integrity without storing massive amounts of JSON data on the blockchain. Instead of executing multiple expensive state-change transactions, the system stores a single 32-byte Merkle root on-chain that can mathematically prove the authenticity of all four lifecycle stages.

## 2. Data Included
Data from the four stages:
1. **CREATE:** Farmer data, herb details, GPS.
2. **TEST:** Lab results, Lab GPS.
3. **PROCESS:** Processing method, yield, Processor GPS.
4. **TRANSFER:** Destination, new owner, Distributor GPS.

## 3. Leaf Generation
Leaves are generated in `merkleService.js` using Node's `crypto` module (SHA-256). The raw data object is deterministically serialized and hashed: `sha256Hex(stageName + ":" + JSON.stringify(stageData))`.

## 4. Tree Construction
The tree always has exactly 4 leaves. Unfilled stages use a deterministic placeholder hash: `sha256Hex("EMPTY")`.
The tree is built bottom-up:
- Layer 0: 4 leaves
- Layer 1: 2 parent hashes (Hash(Leaf0+Leaf1), Hash(Leaf2+Leaf3))
- Layer 2: 1 Root (Hash(Layer1[0]+Layer1[1]))

## 5. Root Generation
The final root is the 32-byte hex string produced at Layer 2.

## 6. Root Storage
Off-chain, the root and all proofs are stored in MongoDB in the `BatchMerkleRoot` collection, keyed by `batchId` (which equates to the `chainId` of the lineage).

## 7. Anchoring to Blockchain
The Merkle root is anchored on-chain ONLY when the **Transfer (Stage 3)** completes, or manually by an admin. The backend calls the `anchorMerkleRoot(string batchId, uint256 stageIndex, bytes32 merkleRoot)` function on the `HerbTrace.sol` contract.

## 8. Proof Generation
Proofs are generated via `generateProof(leafDataArray, stageIndex)`. It returns an array of exactly 2 sibling hashes needed to reconstruct the root from a specific leaf.

## 9. Proof Verification
Verification is done via `verifyProof(root, leaf, proof, stageIndex)`. It hashes the leaf with the first sibling, then that result with the second sibling, and compares the final output to the stored root.

## 10. Stage-Specific Roots/Proofs
Because the tree structure is fixed at 4 leaves, proofs for early stages (e.g., Create) can be generated even if later stages are "EMPTY". However, the final definitive root is anchored after the Transfer stage (completedCount = 4).

## 11. Backend Endpoints
- `GET /batch/:batchId/merkle-proof/:stageIndex` -> Retrieves the proof for a specific stage.

## 12. Smart-Contract Functions
- `anchorMerkleRoot(string batchId, uint256 stageIndex, bytes32 merkleRoot)`
- `getMerkleAnchors(string batchId)`

## 13. Database Models
- `BatchMerkleRoot.js`: Tracks `leaves`, `leafData`, `merkleRoot`, `proofs`, `anchored`, and `stagesCompleted`.

## 14. Testing
Validated by `tests/merkleService.test.js` and `tests/chainId-merkle-e2e.test.js`.
