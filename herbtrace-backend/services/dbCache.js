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
 * Logging prefix: [DB]
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const DB_PATH = process.env.SQLITE_DB_PATH || "./data/herbtrace.db";

// Ensure the data directory exists
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS sync_meta (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS batches (
    batchId       TEXT PRIMARY KEY,
    currentStatus TEXT,
    currentOwner  TEXT,
    dataHash      TEXT,
    lastUpdated   INTEGER,
    parents       TEXT DEFAULT '[]',
    lat           REAL,
    lng           REAL,
    placeName     TEXT
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

// ─── Init ─────────────────────────────────────────────────────────────────────

function initDb() {
  if (db) return db;
  console.log(`[DB] Opening SQLite at ${path.resolve(DB_PATH)}`);
  db = new Database(path.resolve(DB_PATH));
  db.pragma("journal_mode = WAL"); // Write-Ahead Logging for better concurrent reads
  db.exec(SCHEMA);

  // Safely add any new columns to existing SQLite table if missing
  try { db.exec("ALTER TABLE batches ADD COLUMN lat REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE batches ADD COLUMN lng REAL;"); } catch (e) {}
  try { db.exec("ALTER TABLE batches ADD COLUMN placeName TEXT;"); } catch (e) {}

  console.log("[DB] Schema ready.");
  return db;
}

function getDb() {
  if (!db) return initDb();
  return db;
}

// ─── sync_meta ────────────────────────────────────────────────────────────────

function getLastSyncedBlock() {
  const d = getDb();
  const row = d.prepare("SELECT value FROM sync_meta WHERE key = ?").get("last_synced_block");
  return row ? parseInt(row.value, 10) : null;
}

function setLastSyncedBlock(blockNumber) {
  const d = getDb();
  d.prepare("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_synced_block', ?)").run(
    String(blockNumber)
  );
}

// ─── batches ─────────────────────────────────────────────────────────────────

/**
 * Upsert a batch's latest state.
 * @param {object} params
 */
function upsertBatch({ batchId, currentStatus, currentOwner, dataHash, lastUpdated, parents = [], lat = null, lng = null, placeName = null }) {
  const d = getDb();
  d.prepare(`
    INSERT INTO batches (batchId, currentStatus, currentOwner, dataHash, lastUpdated, parents, lat, lng, placeName)
    VALUES (@batchId, @currentStatus, @currentOwner, @dataHash, @lastUpdated, @parents, @lat, @lng, @placeName)
    ON CONFLICT(batchId) DO UPDATE SET
      currentStatus = excluded.currentStatus,
      currentOwner  = excluded.currentOwner,
      dataHash      = excluded.dataHash,
      lastUpdated   = excluded.lastUpdated,
      parents       = excluded.parents,
      lat           = COALESCE(excluded.lat, batches.lat),
      lng           = COALESCE(excluded.lng, batches.lng),
      placeName     = COALESCE(excluded.placeName, batches.placeName)
  `).run({
    batchId,
    currentStatus,
    currentOwner,
    dataHash,
    lastUpdated,
    parents: JSON.stringify(parents),
    lat,
    lng,
    placeName,
  });
}

function getBatchById(batchId) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM batches WHERE batchId = ?").get(batchId);
  if (!row) return null;
  return { ...row, parents: JSON.parse(row.parents || "[]") };
}

function getAllBatches() {
  const d = getDb();
  const rows = d.prepare("SELECT * FROM batches ORDER BY lastUpdated DESC").all();
  return rows.map((row) => ({ ...row, parents: JSON.parse(row.parents || "[]") }));
}

// ─── stage_events ─────────────────────────────────────────────────────────────

/**
 * Insert a stage event. Returns true if inserted (new), false if duplicate (already seen).
 */
function insertStageEvent({ batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex }) {
  const d = getDb();
  try {
    d.prepare(`
      INSERT INTO stage_events (batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex);
    return true; // newly inserted
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint")) {
      return false; // duplicate, already processed
    }
    throw err;
  }
}

/**
 * Get stage events for a batch, ordered by blockNumber ascending.
 */
function getStageEvents(batchId) {
  const d = getDb();
  return d
    .prepare("SELECT * FROM stage_events WHERE batchId = ? ORDER BY blockNumber ASC, logIndex ASC")
    .all(batchId);
}

/**
 * Get stage events for all batches. Returns a map: batchId → events[].
 */
function getAllStageEvents() {
  const d = getDb();
  const rows = d
    .prepare("SELECT * FROM stage_events ORDER BY batchId, blockNumber ASC, logIndex ASC")
    .all();
  const map = {};
  for (const row of rows) {
    if (!map[row.batchId]) map[row.batchId] = [];
    map[row.batchId].push(row);
  }
  return map;
}

// ─── route_cache ──────────────────────────────────────────────────────────────

function upsertRouteCache({ leg, geometry, durationSeconds, isFallback }) {
  const d = getDb();
  d.prepare(`
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
  const d = getDb();
  const row = d.prepare("SELECT * FROM route_cache WHERE leg = ?").get(leg);
  if (!row) return null;
  return {
    leg: row.leg,
    geometry: JSON.parse(row.geometry),
    durationSeconds: row.durationSeconds,
    isFallback: row.isFallback === 1,
    cachedAt: row.cachedAt,
  };
}

// ─── Bulk transaction helper ──────────────────────────────────────────────────

/**
 * Run a callback inside a SQLite transaction.
 * @param {Function} fn
 */
function runTransaction(fn) {
  const d = getDb();
  const tx = d.transaction(fn);
  return tx();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

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
