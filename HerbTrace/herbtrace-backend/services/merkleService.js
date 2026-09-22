/**
 * ============================================================
 * HerbTrace — Merkle Tree Service
 * ============================================================
 *
 * CONCEPT: What is a Merkle Tree?
 * --------------------------------
 * Think of it like a "summary hash" that proves a set of data
 * is authentic without revealing all the data.
 *
 * For a batch with 4 stages:
 *
 *   Leaf 0 (Create)   Leaf 1 (Test)    Leaf 2 (Process)  Leaf 3 (Transfer)
 *       H(create)        H(test)            H(process)        H(transfer)
 *             \             /                      \               /
 *           H(H0 + H1)                          H(H2 + H3)
 *                    \                          /
 *                         MERKLE ROOT (32 bytes)
 *
 * We store the ROOT on-chain (cheap: one 32-byte write).
 * Anyone can PROVE that "Test data X was in this batch" by
 * providing just 2 sibling hashes — no need to reveal all 4 stages.
 *
 * KEY DESIGN:
 * - 4 leaves, always. Indices: 0=Create, 1=Test, 2=Process, 3=Transfer
 * - Unfilled stages get leaf = keccak256("EMPTY") as placeholder
 * - Merkle root is anchored on-chain only when Transfer stage completes
 *
 * ============================================================
 */

const crypto = require("crypto");

// Stage index constants — single source of truth
const STAGE = {
  CREATE:   0,
  TEST:     1,
  PROCESS:  2,
  TRANSFER: 3,
};

const STAGE_NAMES = ["CREATE", "TEST", "PROCESS", "TRANSFER"];
const EMPTY_LEAF_DATA = "EMPTY";

// ─── Hashing Utilities ───────────────────────────────────────────────────────

/**
 * SHA-256 hash of a string → returns lowercase hex string (64 chars = 32 bytes)
 * We use SHA-256 (matching Solidity's keccak256 spirit) for on-chain compatibility.
 * Note: Solidity uses keccak256, but for off-chain Merkle we use sha256 from Node's
 * built-in crypto module (no extra packages needed). The root stored on-chain is
 * this same sha256-based root passed as bytes32.
 */
const sha256Hex = (data) => {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
};

/**
 * Hash two child hashes together (always sort to make the tree order-independent).
 * Sorting ensures the same root no matter which direction you traverse.
 */
const hashPair = (left, right) => {
  // Sort so H(A,B) === H(B,A) — makes proofs simpler
  const [a, b] = left <= right ? [left, right] : [right, left];
  return sha256Hex(a + b);
};

// ─── Core Merkle Functions ───────────────────────────────────────────────────

/**
 * Build a full Merkle tree from an array of 4 leaf data strings.
 *
 * Returns { leaves, tree, root }
 *   leaves — array of 4 hashed leaves (hex strings)
 *   tree   — 2D array: tree[0] = leaves layer, tree[1] = middle, tree[2] = root
 *   root   — final 32-byte (hex) Merkle root
 *
 * @param {string[]} leafDataArray  4-element array of raw data strings per stage.
 *                                  Pass null/undefined for stages not yet completed.
 */
const buildMerkleTree = (leafDataArray) => {
  if (!Array.isArray(leafDataArray) || leafDataArray.length !== 4) {
    throw new Error("buildMerkleTree requires exactly 4 leaf data strings (one per stage).");
  }

  // Hash each leaf. Unfilled stages use a deterministic EMPTY placeholder.
  const leaves = leafDataArray.map((data) =>
    sha256Hex(data !== null && data !== undefined ? String(data) : EMPTY_LEAF_DATA)
  );

  // Build tree bottom-up
  // Layer 0 (bottom): 4 leaves
  // Layer 1 (middle): 2 parent hashes
  // Layer 2 (top):    1 root
  const layer1 = [
    hashPair(leaves[0], leaves[1]), // parent of Create + Test
    hashPair(leaves[2], leaves[3]), // parent of Process + Transfer
  ];
  const root = hashPair(layer1[0], layer1[1]);

  return {
    leaves,          // [H(create), H(test), H(process), H(transfer)]
    tree: [leaves, layer1, [root]], // full 3-layer tree
    root,            // final Merkle root (hex string)
  };
};

/**
 * Generate a Merkle proof for a specific stage index (0–3).
 *
 * A Merkle proof is an ordered list of "sibling" hashes.
 * To verify that leaf at `index` is in the tree, you need to:
 *   1. Hash the target leaf with its sibling  → gets parent
 *   2. Hash the parent with ITS sibling       → gets root
 *   3. Compare final hash to the stored Merkle root
 *
 * @param {string[]} leafDataArray  4-element array of raw stage data strings
 * @param {number}   stageIndex     0=Create, 1=Test, 2=Process, 3=Transfer
 * @returns {{ proof: string[], root: string, leaf: string, stageIndex: number }}
 */
const generateProof = (leafDataArray, stageIndex) => {
  if (stageIndex < 0 || stageIndex > 3) {
    throw new Error("stageIndex must be 0, 1, 2, or 3");
  }

  const { leaves, tree, root } = buildMerkleTree(leafDataArray);
  const proof = [];

  // Layer 0 → Layer 1: find sibling leaf
  // Leaf 0 pairs with Leaf 1; Leaf 2 pairs with Leaf 3
  const siblingLeafIndex = stageIndex % 2 === 0 ? stageIndex + 1 : stageIndex - 1;
  proof.push(leaves[siblingLeafIndex]);

  // Layer 1 → Layer 2: find sibling of the parent node
  // If leaf index 0 or 1 → parent is tree[1][0], sibling parent is tree[1][1]
  // If leaf index 2 or 3 → parent is tree[1][1], sibling parent is tree[1][0]
  const parentIndex = stageIndex < 2 ? 0 : 1;
  const siblingParentIndex = parentIndex === 0 ? 1 : 0;
  proof.push(tree[1][siblingParentIndex]);

  return {
    proof,                          // array of sibling hashes
    root,                           // Merkle root
    leaf: leaves[stageIndex],       // hash of the stage's data
    stageIndex,
    stageName: STAGE_NAMES[stageIndex],
  };
};

/**
 * Verify a Merkle proof.
 *
 * Given:
 *   - root      : the stored Merkle root
 *   - leaf      : hash of the stage data you're claiming
 *   - proof     : array of sibling hashes [sibling0, sibling1]
 *   - stageIndex: which stage (0–3) is being verified
 *
 * Returns true if the proof is valid (data was in the tree).
 *
 * @param {string}   root        Merkle root (hex)
 * @param {string}   leaf        Hash of claimed stage data (hex)
 * @param {string[]} proof       Sibling hashes from generateProof
 * @param {number}   stageIndex  0–3
 * @returns {boolean}
 */
const verifyProof = (root, leaf, proof, stageIndex) => {
  if (!root || !leaf || !Array.isArray(proof) || proof.length !== 2) {
    return false;
  }

  // Step 1: hash leaf with its sibling → get parent
  const parent = hashPair(leaf, proof[0]);

  // Step 2: hash parent with its sibling → get computed root
  const computedRoot = hashPair(parent, proof[1]);

  return computedRoot === root;
};

/**
 * Convert a hex Merkle root to bytes32 format for Solidity/ethers.
 * Prepends "0x" if not already present.
 *
 * @param {string} hexRoot  64-char hex string
 * @returns {string}        "0x" + hexRoot
 */
const toBytes32 = (hexRoot) => {
  if (!hexRoot) throw new Error("hexRoot is required");
  return hexRoot.startsWith("0x") ? hexRoot : `0x${hexRoot}`;
};

/**
 * Build stage leaf data string from a batch stage's raw data.
 * Deterministically serialises the data object for hashing.
 *
 * @param {string} stageName  e.g. "CREATE"
 * @param {object} stageData  raw stage data object
 * @returns {string}
 */
const buildLeafData = (stageName, stageData) => {
  return `${stageName}:${JSON.stringify(stageData, Object.keys(stageData).sort())}`;
};

module.exports = {
  STAGE,
  STAGE_NAMES,
  buildMerkleTree,
  generateProof,
  verifyProof,
  toBytes32,
  buildLeafData,
  sha256Hex,
};
