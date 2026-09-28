const Database = require("better-sqlite3");
const mongoose = require("mongoose");
const Batch = require("../models/Batch");
require("dotenv").config();

async function findInCache() {
  const db = new Database("./data/herbtrace.db");
  const batchId = "TULSI-1790105993038";

  console.log("Searching SQLite cache for", batchId, "...");
  const events = db.prepare("SELECT * FROM stage_events WHERE batchId = ?").all(batchId);
  console.log("Events in SQLite cache:", events);

  const batches = db.prepare("SELECT * FROM batches WHERE batchId = ?").all(batchId);
  console.log("Batch in SQLite cache:", batches);

  db.close();
}

findInCache();
