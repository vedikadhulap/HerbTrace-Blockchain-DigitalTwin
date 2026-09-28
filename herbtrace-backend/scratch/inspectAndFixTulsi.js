const mongoose = require("mongoose");
const { getContract } = require("../services/blockchainService");
const Batch = require("../models/Batch");
require("dotenv").config();

async function inspectBatch() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const batchId = "TULSI-1790105993038";
  const batch = await Batch.findOne({ batchId });
  console.log("\n📦 MongoDB Document for", batchId, ":");
  console.log("  status:", batch?.status);
  console.log("  txHash in DB:", batch?.txHash);

  // Now query Sepolia contract events for BatchCreated / TestRecorded
  console.log("\n🔍 Querying Sepolia contract events for batchId:", batchId, "...");
  const contract = getContract("admin");

  try {
    const filter = contract.filters.BatchCreated(batchId);
    const events = await contract.queryFilter(filter, 11759000, "latest");
    console.log(`Found ${events.length} BatchCreated events for ${batchId}:`);
    for (const evt of events) {
      console.log("  Event txHash:", evt.transactionHash, "Block:", evt.blockNumber);
      if (batch && evt.transactionHash && (!batch.txHash || !batch.txHash.startsWith("0x"))) {
        console.log("  Updating MongoDB txHash with real Sepolia txHash:", evt.transactionHash);
        batch.txHash = evt.transactionHash;
        await batch.save();
        console.log("  ✅ Saved real txHash to MongoDB!");
      }
    }
  } catch (err) {
    console.error("Error querying contract events:", err.message);
  }

  await mongoose.disconnect();
}

inspectBatch();
