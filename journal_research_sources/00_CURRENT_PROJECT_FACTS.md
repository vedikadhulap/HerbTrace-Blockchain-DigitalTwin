# CURRENT HERBTRACE PROJECT — VERIFIED RESEARCH FACTS

## 1. Project Identity

* **Project name:** HerbTrace
* **Research domain:** Blockchain-based Supply Chain Traceability
* **Problem addressed:** Ensuring data integrity, verifiable lineage, and geospatial authenticity for herbal medicine batches while minimizing on-chain storage costs.
* **Scope:** The system tracks a batch from farmer cultivation, through lab testing, processor transformation, and finally to distributor custody.
* **Note:** The Digital Twin concept is strictly outside the scope of this paper and this implementation.

## 2. Current System Architecture

* **Frontend:** Built with React/Vite. Contains role-specific interfaces and a public verification UI.
* **Backend:** Node.js/Express.js server responsible for business logic, Merkle tree construction, and API handling.
* **Database:** MongoDB, used for off-chain storage of complex batch data, Merkle structures, and location verifications.
* **Blockchain:** Ethereum-compatible network (tested locally via Hardhat, configured for Sepolia testnet).
* **Smart contract:** Written in Solidity (`HerbTrace.sol`, v0.8.27). Uses OpenZeppelin's `AccessControl`.
* **External services/oracles:** Four reverse-geocoding APIs (Nominatim, BigDataCloud, Geocode.Maps.co, OpenCage) and IPFS (Pinata) for image uploads.
* **Communication:** The frontend communicates with the backend via REST HTTP APIs. The backend communicates with MongoDB (Mongoose), external Oracles (HTTP), and the Blockchain (Ethers.js via RPC). The backend signs transactions using securely stored private keys.

## 3. Current Supply-Chain Lifecycle

**Stage 0: CREATE**
* **Actor:** Farmer
* **Operation:** Submits initial raw herb batch details.
* **Backend operation:** Creates MongoDB `Batch` and `BatchMerkleRoot`. Sets `chainId = batchId`.
* **Blockchain operation:** Calls `createBatch()` on the smart contract.
* **Data generated:** Herb type, farming method, lot number, farmer wallet, farm GPS, initial `dataHash`.
* **Verification mechanism:** Leaf 0 of the Merkle tree is generated. Multi-oracle location consensus runs.

**Stage 1: TEST**
* **Actor:** Laboratory
* **Operation:** Submits test results for a raw batch.
* **Backend operation:** Updates MongoDB `Batch` with lab data.
* **Blockchain operation:** Calls `recordTest()` on the smart contract.
* **Data generated:** Moisture, purity, lab wallet, lab GPS, updated `dataHash`.
* **Verification mechanism:** Leaf 1 of the Merkle tree is generated. Multi-oracle location consensus runs.

**Stage 2: PROCESS**
* **Actor:** Processor
* **Operation:** Transforms one or more raw batches into a new processed batch.
* **Backend operation:** Creates new MongoDB `Batch`. Links `parentBatchIds`. Inherits `chainId` from the first parent.
* **Blockchain operation:** Calls `processBatch()` on the smart contract.
* **Data generated:** New `batchId`, processing notes, yield, processor GPS, updated `dataHash`.
* **Verification mechanism:** Leaf 2 of the Merkle tree is generated (under the parent's `chainId`). Multi-oracle location consensus runs.

**Stage 3: TRANSFER**
* **Actor:** Distributor
* **Operation:** Assumes custody of the processed batch.
* **Backend operation:** Updates the processed MongoDB `Batch`.
* **Blockchain operation:** Calls `transferCustody()` and subsequently `anchorMerkleRoot()` to store the final root on-chain.
* **Data generated:** Destination, new owner wallet, distributor GPS, updated `dataHash`.
* **Verification mechanism:** Leaf 3 is generated. Tree is complete. Final 32-byte Merkle root is anchored on-chain. Multi-oracle location consensus runs and is optionally anchored.

## 4. Batch Representation

* **On-chain data:** `batchId`, `currentOwner`, `status` (Enum), `dataHash` (bytes32), `lastUpdated` (timestamp).
* **Off-chain database data:** `herbType`, `farmingMethod`, raw/typed location data, comprehensive lab results, processing notes, IPFS image URLs, `chainId`, `parentBatchIds`.

## 5. Batch Lineage

* **batchId:** A unique identifier for a specific physical state of a batch (e.g., Raw Leaves vs. Processed Powder). (Stored On-chain and Off-chain).
* **chainId:** An off-chain MongoDB field used to group multiple `batchId`s into a single continuous Merkle tree lineage. (Stored exclusively Off-chain).
* **parentBatchIds:** An array of `batchId`s representing the raw materials used to create a processed batch. (Stored On-chain and Off-chain).
* **parent-child relationships:** A processed batch (child) maps to its raw batches (parents). 
* **How lineage is maintained:** When a processed batch is created, it inherits the `chainId` of its first parent batch (`parents[0].chainId`). This ensures the new processing events update the original Merkle tree.
* **Where lineage is stored:** Off-chain in MongoDB `Batch` documents, and On-chain via the `parents` mapping.

## 6. Merkle-Based Integrity

* **Leaf data:** Deterministically serialized JSON containing the stage's specific data (e.g., `CREATE:{"batchId":"123","herbType":"Ashwagandha"}`).
* **Hashing:** SHA-256 (via Node.js `crypto`).
* **Tree construction:** Exactly 4 leaves. Empty stages are hashed as `sha256Hex("EMPTY")`.
* **Root generation:** Standard bottom-up pairwise hashing of leaves.
* **Root anchoring:** Only anchored on the blockchain by the Admin wallet when Stage 3 (Transfer) completes.
* **Proof generation:** Provided by the backend returning an array of exactly 2 sibling hashes.
* **Proof verification:** Client hashes their target leaf with sibling 1, then the result with sibling 2, and compares it to the anchored root.
* **Stage handling:** Supported across the 4 fixed stages.
* **Relevant APIs:** `GET /batch/:batchId/merkle-proof/:stageIndex`

## 7. Location Verification

* **GPS capture:** HTML5 Geolocation API (`navigator.geolocation.getCurrentPosition`) on the frontend.
* **Location providers:** Nominatim, BigDataCloud, Geocode.Maps.co, OpenCage.
* **Number of providers:** 4.
* **Consensus mechanism:** Compares distance between returned coordinates from pairs of oracles.
* **Distance threshold:** Configurable, defaults to 100 metres.
* **Stored results:** If agreement is reached, `verified=true`, `consensus="verified"`, and `agreedLocation` is saved. Otherwise, flagged as `low_confidence` for admin review.
* **On-chain/off-chain handling:** Granular oracle responses are kept off-chain in MongoDB. The final boolean consensus and human-readable location string are anchored on-chain via `recordLocationVerification()`.

## 8. Smart Contract

* **Name:** `HerbTrace.sol`
* **Roles:** `FARMER_ROLE`, `LAB_ROLE`, `PROCESSOR_ROLE`, `DISTRIBUTOR_ROLE`.

**Key Functions:**
* `createBatch()`: Records initial `dataHash` and ownership. (Input: `batchId`, `dataHash`)
* `recordTest()`: Updates `dataHash` and status. (Input: `batchId`, `dataHash`)
* `processBatch()`: Records new processed `batchId`, sets `parents`, stores `dataHash`. (Input: `newBatchId`, `parentBatchIds`, `dataHash`)
* `transferCustody()`: Updates owner and `dataHash`. (Input: `batchId`, `newOwner`, `dataHash`)
* `anchorMerkleRoot()`: Anchors the final 32-byte Merkle root. (Input: `batchId`, `stageIndex`, `merkleRoot`)
* `recordLocationVerification()`: Anchors the consensus location. (Input: `batchId`, `stageIndex`, `verified`, `location`)

## 9. Backend APIs

* `POST /batch/create` - Start a raw batch.
* `POST /batch/lab-test` - Add lab results.
* `POST /batch/process` - Combine raw batches into a processed batch.
* `POST /batch/transfer` - Transfer final batch to a distributor.
* `GET /batch/:id` - Fetch batch JSON details.
* `GET /batch/verify/:batchId` - Fetch complete verification payload (lineage, data).
* `GET /batch/:batchId/merkle-proof/:stageIndex` - Fetch cryptographic Merkle proof for a stage.
* `GET /batch/:batchId/location-verification` - Fetch the multi-oracle location consensus report.

## 10. Verification

* **Batch information:** Client queries `GET /batch/verify/:batchId` to read off-chain details.
* **Blockchain transaction:** User checks the returned `txHash` on a standard block explorer (e.g., Etherscan).
* **Merkle proof:** Client queries `getMerkleProof`, receives siblings, and computes the root locally to compare against the public on-chain root fetched from `getMerkleAnchors()`.
* **Lineage:** Client queries the on-chain `getParents()` function to prove a processed batch legitimately derived from raw batches.
* **Location verification:** Client checks the on-chain `getLocationVerifications()` array to prove that consensus was achieved for a specific stage.

## 11. Testing Evidence

* **Smart Contract Logic:** `HerbTraceV2.test.js` proves that the contract stores hashes, anchors Merkle roots, restricts access via RBAC, and prevents double-anchoring. (Tested Locally).
* **Merkle Generation:** `merkleService.test.js` proves that a 4-leaf tree is built correctly and proofs verify mathematically. (Tested Locally).
* **Lineage/ChainId Logic:** `chainId-merkle-e2e.test.js` proves that a processed batch successfully inherits its parent's `chainId` off-chain, and all 4 stages correctly roll up into a single Merkle tree. (Tested Locally).
* **Location Consensus:** `multiOracleService.test.js` proves that oracle results are successfully aggregated and evaluated against distance thresholds. (Tested Locally).
* **Testnet Evidence:** Configuration for Sepolia exists, but no recorded transaction hashes or receipts from Sepolia are documented in the codebase.

## 12. Verified Experimental Results

* **Metric:** Logical Merkle Proof Verification across batch lineage.
* **Value:** 100% Success (4 out of 4 stages verify against a single inherited root).
* **Environment:** Local Node.js / MongoDB via automated test.
* **Source/evidence:** `herbtrace-backend/tests/chainId-merkle-e2e.test.js`

* **Metric:** Gas Used / Transaction Cost
* **Value:** Not experimentally measured. (No gas reporter output found).

* **Metric:** Latency / API Response Time
* **Value:** Not experimentally measured.

## 13. Current Limitations

* The Merkle tree is hardcoded to a fixed 4-stage lifecycle, limiting flexibility for supply chains requiring 3 or 5+ stages.
* The system utilizes a custodial backend wallet design; private keys are stored centrally in `.env` rather than held by the user in a Web3 wallet extension.
* Complete reliance on the uptime of third-party Web2 geocoding APIs for location consensus.
* Loss of the MongoDB off-chain database would render the on-chain Merkle root useless, as the underlying leaves and proofs could no longer be generated.

## 14. Potential Research Contributions

* The system implements an off-chain `chainId` threading mechanism that merges the lifecycle events of parent and child batches into a single Merkle tree, anchoring only once on-chain.
* The architecture integrates a multi-oracle geospatial consensus model, utilizing distance thresholding to verify physical locations before anchoring the result on the blockchain.

## 15. Claims Requiring Experimental Validation

The following claims should **NOT** be made until experiments are run:
* **Gas/Cost reduction:** Requires running `hardhat-gas-reporter` to compare the total gas of 4 separate transactions vs. the single `anchorMerkleRoot` transaction.
* **Latency/Performance improvement:** Requires load testing the backend API to prove that the off-chain Merkle tree computation is highly performant.
* **Oracle reliability/uptime:** Requires a longitudinal study measuring the success rate of the 4 oracles over time in a live environment to prove the consensus model is more robust than a single API.
* **Security robustness:** Requires deploying to a public Testnet (e.g., Sepolia) and exposing the contract to standard security auditing tools.

## 16. Source Map

* **Smart Contract Structures & Roles:** `herbtrace-contracts/contracts/HerbTrace.sol`
* **Lineage Threading (`chainId`):** `herbtrace-backend/models/Batch.js`, `herbtrace-backend/tests/chainId-merkle-e2e.test.js`
* **Merkle Tree Construction:** `herbtrace-backend/services/merkleService.js`
* **Multi-Oracle Location Consensus:** `herbtrace-backend/models/LocationVerification.js`
* **Backend Transaction Signing:** `herbtrace-backend/services/blockchainService.js`
* **GPS Coordinate Capture:** `herbtrace-frontend/src/components/GPSBar.jsx`

## 17. One-Paragraph Technical Summary

HerbTrace is a hybrid blockchain traceability system built on Ethereum, Node.js, and React that tracks the 4-stage lifecycle of herbal medicines. To minimize on-chain data storage and execution costs, it stores comprehensive payload data and parent-child batch lineage off-chain in MongoDB, grouped by an inherited `chainId`. This `chainId` allows the system to construct a single 4-leaf Merkle tree spanning the entire lineage—from raw cultivation to processed transfer—anchoring only a final 32-byte root to a minimalist Solidity smart contract. Additionally, it features a multi-oracle geospatial consensus mechanism that reverse-geocodes frontend GPS coordinates against four distinct APIs, requiring distance-based agreement to prevent location spoofing before anchoring the verification status on-chain.
