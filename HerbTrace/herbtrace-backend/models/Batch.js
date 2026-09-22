const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    batchId:           { type: String, required: true, unique: true },
    // chainId threads the Merkle tree across stage transitions.
    // A raw batch sets chainId = its own batchId.
    // A processed batch inherits chainId from its first parent (raw) batch.
    // This means all 4 stages (Create→Test→Process→Transfer) share one tree.
    chainId:           { type: String, index: true },
    herbType:          { type: String, required: true },
    herbVariety:       { type: String },
    farmingMethod:     { type: String, enum: ["Organic", "Conventional", "Biodynamic", "Wildcrafted"] },
    estimatedMoisture: { type: Number },
    lotNumber:         { type: String },
    expectedDryWeight: { type: Number },
    farmerWallet:      { type: String, required: true },
    farmLocation:      { type: String },
    location: {
      latitude:  { type: Number },
      longitude: { type: Number },
    },
    harvestDate: { type: Date },
    quantityKg:  { type: Number },
    images:      [{ type: String }], // IPFS URLs
    status:      { type: String, enum: ["CREATED", "TESTED", "PROCESSED", "TRANSFERRED"], default: "CREATED" },
    dataHash:    { type: String, required: true }, // hash written on-chain
    txHash:      { type: String }, // Ethereum transaction hash — look up on Etherscan

    // User attribution
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Farmer user ID
    testedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Lab user ID
    processedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Processor user ID
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Distributor user ID

    // Lineage — parent raw batches that were combined in processBatch
    parentBatchIds: [{ type: String }],

    // Lab stage data
    labData:     { type: mongoose.Schema.Types.Mixed },
    labLocation: {
      latitude:  { type: Number },
      longitude: { type: Number },
    },

    // Processor stage data
    processorData:   { type: mongoose.Schema.Types.Mixed },
    processLocation: {
      latitude:  { type: Number },
      longitude: { type: Number },
    },

    // Distributor stage data
    transferData:     { type: mongoose.Schema.Types.Mixed },
    transferLocation: {
      latitude:  { type: Number },
      longitude: { type: Number },
    },
  },
  { timestamps: true } // adds createdAt / updatedAt automatically
);

module.exports = mongoose.model("Batch", batchSchema);