/**
 * ============================================================
 * BatchMerkleRoot — MongoDB Model
 * ============================================================
 *
 * Stores one document per batch containing:
 *   - The 4 raw leaf data strings (one per stage)
 *   - The 4 hashed leaves
 *   - The current Merkle root (recomputed as stages fill in)
 *   - Proofs for each completed stage
 *   - The on-chain anchor transaction hash (once final root is written)
 *
 * LIFECYCLE:
 *   Stage 0 (Create)   → leaves[0] filled, root computed with 3 EMPTY leaves
 *   Stage 1 (Test)     → leaves[1] filled, root recomputed
 *   Stage 2 (Process)  → leaves[2] filled, root recomputed
 *   Stage 3 (Transfer) → leaves[3] filled, FINAL root anchored on-chain
 *
 * ============================================================
 */

const mongoose = require("mongoose");

const proofSchema = new mongoose.Schema(
  {
    stageIndex: { type: Number, required: true },        // 0–3
    stageName:  { type: String, required: true },        // CREATE|TEST|PROCESS|TRANSFER
    leaf:       { type: String, required: true },        // sha256 of this stage's data
    proof:      [{ type: String }],                      // sibling hashes [2 elements]
    leafData:   { type: String },                        // raw data string that was hashed
    verified:   { type: Boolean, default: false },       // did verifyProof() pass?
  },
  { _id: false }
);

const batchMerkleRootSchema = new mongoose.Schema(
  {
    batchId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    // ── Leaf layer (hashed) ──────────────────────────────────────────────────
    // Always exactly 4 entries. Unfilled stages store sha256("EMPTY").
    leaves: {
      type:    [String],
      default: [],
    },

    // ── Raw leaf data strings (for proof generation / audit) ─────────────────
    // Stored so proofs can be regenerated even if the original request data is lost
    leafData: {
      type:    [String],
      default: [],
    },

    // ── Current Merkle root ──────────────────────────────────────────────────
    // Recomputed each time a stage fills in. Final value written on-chain.
    merkleRoot: {
      type:    String,
      default: null,
    },

    // ── Per-stage proofs ─────────────────────────────────────────────────────
    proofs: {
      type:    [proofSchema],
      default: [],
    },

    // ── On-chain anchor data ─────────────────────────────────────────────────
    anchored:        { type: Boolean, default: false },
    anchoredTxHash:  { type: String,  default: null },   // Ethereum tx hash
    anchoredAt:      { type: Date,    default: null },

    // ── Progress tracking ────────────────────────────────────────────────────
    // Which stages have been filled (bitmask-style via array of booleans)
    stagesCompleted: {
      type:    [Boolean],
      default: [false, false, false, false], // [create, test, process, transfer]
    },
    completedCount: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// Note: batchId already has a unique index defined inline in the schema above.
batchMerkleRootSchema.index({ anchored: 1 });

// ── Virtual: is tree complete? ───────────────────────────────────────────────
batchMerkleRootSchema.virtual("isComplete").get(function () {
  return this.completedCount === 4;
});

module.exports = mongoose.model("BatchMerkleRoot", batchMerkleRootSchema);
