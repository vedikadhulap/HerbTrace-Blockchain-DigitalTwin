/**
 * ============================================================
 * LocationVerification — MongoDB Model
 * ============================================================
 *
 * One document per (batchId + stage) location check.
 * A batch can have up to 4 location checks:
 *   Stage 0: Create  (farm GPS)
 *   Stage 1: Test    (lab GPS)
 *   Stage 2: Process (processor GPS)
 *   Stage 3: Transfer (distributor GPS)
 *
 * Documents with consensus="low_confidence" are flagged for admin review.
 *
 * ============================================================
 */

const mongoose = require("mongoose");

// ── Individual oracle result sub-schema ─────────────────────────────────────
const oracleResultSchema = new mongoose.Schema(
  {
    oracle:      { type: String, required: true },  // nominatim|bigdatacloud|geocode.maps.co|opencage
    success:     { type: Boolean, required: true },
    city:        { type: String, default: "" },
    state:       { type: String, default: "" },
    country:     { type: String, default: "" },
    displayName: { type: String, default: "" },
    rawLat:      { type: Number },
    rawLon:      { type: Number },
    error:       { type: String, default: null },   // error message if success=false
  },
  { _id: false }
);

// ── Agreement pair sub-schema ─────────────────────────────────────────────────
const agreementPairSchema = new mongoose.Schema(
  {
    oracles:     [{ type: String }],                // ["nominatim", "bigdatacloud"]
    distanceM:   { type: Number },                  // distance in metres between their coords
    location1:   { type: String },
    location2:   { type: String },
    agreedCity:  { type: String },
    agreedState: { type: String },
  },
  { _id: false }
);

// ── Main schema ──────────────────────────────────────────────────────────────
const locationVerificationSchema = new mongoose.Schema(
  {
    batchId: {
      type:     String,
      required: true,
      index:    true,
    },

    // Which stage triggered this check
    stage: {
      type:    String,
      enum:    ["CREATE", "TEST", "PROCESS", "TRANSFER"],
      required: true,
    },
    stageIndex: {
      type:    Number,
      min:     0,
      max:     3,
      required: true,
    },

    // GPS coordinates submitted by the user
    latitude:  { type: Number, required: true },
    longitude: { type: Number, required: true },

    // What the user typed as their location
    typedLocation: { type: String, default: "" },

    // Individual oracle responses
    oracleResults: { type: [oracleResultSchema], default: [] },

    // Pairs that agreed (distance ≤ threshold)
    agreementPairs: { type: [agreementPairSchema], default: [] },

    // Final consensus verdict
    consensus: {
      type:    String,
      enum:    ["verified", "low_confidence", "no_data"],
      required: true,
    },
    confidence:    { type: Number, default: 0 },    // 0–100 percent
    verified:      { type: Boolean, default: false },
    agreedLocation:{ type: String, default: null },  // best agreed location string
    typedMatches:  { type: Boolean, default: false },

    // Meta
    successCount: { type: Number, default: 0 },     // oracles that responded successfully
    failureCount: { type: Number, default: 0 },
    thresholdM:   { type: Number, default: 100 },   // metres threshold used
    durationMs:   { type: Number },                  // how long consensus took
    message:      { type: String },

    // On-chain record (if ENABLE_MULTI_ORACLE=true and Transfer stage)
    anchoredOnChain: { type: Boolean, default: false },
    anchorTxHash:    { type: String, default: null },

    // Admin review flag
    needsAdminReview: { type: Boolean, default: false },
    adminReviewed:    { type: Boolean, default: false },
    adminNotes:       { type: String,  default: null },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
locationVerificationSchema.index({ batchId: 1, stage: 1 }, { unique: true });
locationVerificationSchema.index({ consensus: 1, needsAdminReview: 1 });

// ── Pre-save hook: auto-flag low confidence for admin review ─────────────────
locationVerificationSchema.pre("save", function (next) {
  if (this.isNew && this.consensus === "low_confidence") {
    this.needsAdminReview = true;
  }
  next();
});

module.exports = mongoose.model("LocationVerification", locationVerificationSchema);
