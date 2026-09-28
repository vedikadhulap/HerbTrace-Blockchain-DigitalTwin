const Database = require("better-sqlite3");
const mongoose = require("mongoose");
const Batch = require("../models/Batch");
require("dotenv").config();

async function updateTulsi() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");

  const batchId = "TULSI-1790105993038";
  const realTxHash = "0x86b1a4a81eb631aeafa876947906d7bf20065c789f02c4acb2e36e665ce26f80";

  const res = await Batch.updateOne(
    { batchId },
    { $set: { txHash: realTxHash } }
  );

  console.log("Updated TULSI-1790105993038 in MongoDB:", res);

  // Also check if any other MongoDB batches have dummy tx- hashes and update them from SQLite stage_events if available
  const db = new Database("./data/herbtrace.db");
  const dummyBatches = await Batch.find({ txHash: { $regex: /^tx-/ } });
  console.log(`Found ${dummyBatches.length} MongoDB batches with dummy tx- hashes.`);

  for (const b of dummyBatches) {
    const evt = db.prepare("SELECT txHash FROM stage_events WHERE batchId = ? AND txHash LIKE '0x%' ORDER BY id ASC LIMIT 1").get(b.batchId);
    if (evt && evt.txHash) {
      console.log(`Fixing ${b.batchId}: replacing ${b.txHash} -> ${evt.txHash}`);
      b.txHash = evt.txHash;
      await b.save();
    }
  }

  db.close();
  await mongoose.disconnect();
  console.log("Done!");
}

updateTulsi();
