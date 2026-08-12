const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: true,
      unique: true, // enforced at the DB level — no two batches share an ID
    },
    herbType: {
      type: String,
      required: true,
    },
    farmerWallet: {
      type: String,
      required: true,
    },
    farmLocation: {
      type: String,
    },
    harvestDate: {
      type: Date,
    },
    quantityKg: {
      type: Number,
    },
    images: [
      {
        type: String, // IPFS URLs, added when we build Pinata upload in Phase 7
      },
    ],
    status: {
      type: String,
      enum: ["CREATED", "TESTED", "PROCESSED", "TRANSFERRED"],
      default: "CREATED",
    },
    dataHash: {
      type: String, // the hash actually written on-chain for this batch's current state
      required: true,
    },
    txHash: {
      type: String, // the Ethereum transaction hash — lets you look this up on Etherscan
    },
    parentBatchIds: [
      {
        type: String, // for processBatch — tracks lineage from raw batches
      },
    ],
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

module.exports = mongoose.model("Batch", batchSchema);