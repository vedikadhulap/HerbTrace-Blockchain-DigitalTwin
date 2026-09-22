/**
 * dbCache.js — SQLite persistent cache for the HerbTrace Digital Twin.
 *
 * Tables:
 *  sync_meta   — key/value store (e.g. last_synced_block)
 *  batches     — latest state per batch (from blockchain events)
 *  stage_events — per-event history with block timestamps (dedupe by txHash+logIndex)
 *  route_cache — OSRM route geometries keyed by leg name
 *
 * All writes go through a single Database instance (synchronous better-sqlite3).
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const DB_PATH = process.env.SQLITE_DB_PATH || "./data/herbtrace.db";

const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS batches (
    batchId      TEXT PRIMARY KEY,
    currentStatus TEXT,
    currentOwner TEXT,
    dataHash     TEXT,
    lastUpdated  INTEGER,
    parents      TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS stage_events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    batchId        TEXT    NOT NULL,
    eventName      TEXT    NOT NULL,
    blockNumber    INTEGER NOT NULL,
    blockTimestamp INTEGER NOT NULL,
    txHash         TEXT    NOT NULL,
    logIndex       INTEGER NOT NULL,
    UNIQUE(txHash, logIndex)
  );

  CREATE TABLE IF NOT EXISTS route_cache (
    leg             TEXT PRIMARY KEY,
    geometry        TEXT NOT NULL,
    durationSeconds REAL NOT NULL,
    isFallback      INTEGER NOT NULL DEFAULT 0,
    cachedAt        INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_stage_events_batchId ON stage_events(batchId);
`;

function initDb() {
  console.log(`[DB] Opening SQLite at ${path.resolve(DB_PATH)}`);
  db = new Database(path.resolve(DB_PATH));
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  console.log("[DB] Schema ready.");
  return db;
}

function getLastSyncedBlock() {
  if (!db) throw new Error("[DB] Database not initialised");
  const row = db.prepare("SELECT value FROM sync_meta WHERE key = ?").get("last_synced_block");
  return row ? parseInt(row.value, 10) : null;
}

function setLastSyncedBlock(blockNumber) {
  if (!db) throw new Error("[DB] Database not initialised");
  db.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_synced_block', ?)").run(
    String(blockNumber)
  );
}

function upsertBatch({ batchId, currentStatus, currentOwner, dataHash, lastUpdated, parents = [] }) {
  if (!db) throw new Error("[DB] Database not initialised");
  db.prepare(`
    INSERT INTO batches (batchId, currentStatus, currentOwner, dataHash, lastUpdated, parents)
    VALUES (@batchId, @currentStatus, @currentOwner, @dataHash, @lastUpdated, @parents)
    ON CONFLICT(batchId) DO UPDATE SET
      currentStatus = excluded.currentStatus,
      currentOwner  = excluded.currentOwner,
      dataHash      = excluded.dataHash,
      lastUpdated   = excluded.lastUpdated,
      parents       = excluded.parents
  `).run({
    batchId,
    currentStatus,
    currentOwner,
    dataHash,
    lastUpdated,
    parents: JSON.stringify(parents),
  });
}

function getBatchById(batchId) {
  if (!db) throw new Error("[DB] Database not initialised");
  const row = db.prepare("SELECT * FROM batches WHERE batchId = ?").get(batchId);
  if (!row) return null;
  return { ...row, parents: JSON.parse(row.parents || "[]") };
}

function getAllBatches() {
  if (!db) throw new Error("[DB] Database not initialised");
  const rows = db.prepare("SELECT * FROM batches ORDER BY lastUpdated DESC").all();
  return rows.map((row) => ({ ...row, parents: JSON.parse(row.parents || "[]") }));
}

function insertStageEvent({ batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex }) {
  if (!db) throw new Error("[DB] Database not initialised");
  try {
    db.prepare(`
      INSERT INTO stage_events (batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex);
    return true;
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint")) {
      return false;
    }
    throw err;
  }
}

function getStageEvents(batchId) {
  if (!db) throw new Error("[DB] Database not initialised");
  return db
    .prepare("SELECT * FROM stage_events WHERE batchId = ? ORDER BY blockNumber ASC, logIndex ASC")
    .all(batchId);
}

function getAllStageEvents() {
  if (!db) throw new Error("[DB] Database not initialised");
  const rows = db
    .prepare("SELECT * FROM stage_events ORDER BY batchId, blockNumber ASC, logIndex ASC")
    .all();
  const map = {};
  for (const row of rows) {
    if (!map[row.batchId]) map[row.batchId] = [];
    map[row.batchId].push(row);
  }
  return map;
}

function upsertRouteCache({ leg, geometry, durationSeconds, isFallback }) {
  if (!db) throw new Error("[DB] Database not initialised");
  db.prepare(`
    INSERT INTO route_cache (leg, geometry, durationSeconds, isFallback, cachedAt)
    VALUES (@leg, @geometry, @durationSeconds, @isFallback, @cachedAt)
    ON CONFLICT(leg) DO UPDATE SET
      geometry        = excluded.geometry,
      durationSeconds = excluded.durationSeconds,
      isFallback      = excluded.isFallback,
      cachedAt        = excluded.cachedAt
  `).run({
    leg,
    geometry: JSON.stringify(geometry),
    durationSeconds,
    isFallback: isFallback ? 1 : 0,
    cachedAt: Math.floor(Date.now() / 1000),
  });
}

function getRouteCache(leg) {
  if (!db) throw new Error("[DB] Database not initialised");
  const row = db.prepare("SELECT * FROM route_cache WHERE leg = ?").get(leg);
  if (!row) return null;
  return {
    leg: row.leg,
    geometry: JSON.parse(row.geometry),
    durationSeconds: row.durationSeconds,
    isFallback: row.isFallback === 1,
    cachedAt: row.cachedAt,
  };
}

function runTransaction(fn) {
  if (!db) throw new Error("[DB] Database not initialised");
  const tx = db.transaction(fn);
  return tx();
}

module.exports = {
  initDb,
  getLastSyncedBlock,
  setLastSyncedBlock,
  upsertBatch,
  getBatchById,
  getAllBatches,
  insertStageEvent,
  getStageEvents,
  getAllStageEvents,
  upsertRouteCache,
  getRouteCache,
  runTransaction,
};
