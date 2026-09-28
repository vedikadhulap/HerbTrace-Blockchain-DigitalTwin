/**
 * blockchainSync.js — Ethereum event sync for HerbTrace Digital Twin.
 *
 * Responsibilities:
 *   1. Historical sync: queryFilter from last synced block → latest, in chunks.
 *   2. Persist every event to SQLite (dbCache). Dedupe by (txHash, logIndex).
 *   3. Resolve block timestamps via provider.getBlock (with local cache).
 *   4. Attach live listeners + 4s poll loop to ensure zero missed events.
 *   5. For live events: update DB, compute delay legs, emit batch:updated via Socket.IO.
 *   6. Trigger location simulator for live stage transitions.
 *
 * Contract events → Digital Twin status mapping:
 *   BatchCreated       → "Collected"
 *   TestRecorded       → "Tested"
 *   BatchProcessed     → "Processed"
 *   CustodyTransferred  → "Distributed"
 *
 * Logging prefix: [SYNC]
 */

const { ethers } = require("ethers");
const BatchModel = require("../models/Batch");
require("dotenv").config();

const {
  getLastSyncedBlock,
  setLastSyncedBlock,
  upsertBatch,
  insertStageEvent,
  getAllBatches,
  getStageEvents,
  runTransaction,
} = require("./dbCache");

const { computeDelayLegs, formatLegsForEmission } = require("./delayService");
const { startSimulation, getLegForTransition, getStaticPosition } = require("./locationSimulator");

// ─── Config ───────────────────────────────────────────────────────────────────

const CHUNK_SIZE    = parseInt(process.env.SYNC_CHUNK_SIZE || "10", 10);
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS;
const RPC_URL       = process.env.ALCHEMY_RPC_URL;

// Exact event signatures matching the deployed Sepolia contract
const EVENT_ABI = [
  "event BatchCreated(string batchId, address farmer, bytes32 dataHash)",
  "event TestRecorded(string batchId, address lab, bytes32 dataHash)",
  "event TestFailed(string batchId, address lab, bytes32 dataHash, string reason)",
  "event BatchProcessed(string newBatchId, address processor, bytes32 dataHash)",
  "event CustodyTransferred(string batchId, address newOwner, bytes32 dataHash)",
  "event BatchRecalled(string batchId, address admin, string reason)",
];

// ─── Provider / contract ──────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDR, EVENT_ABI, provider);

// ─── Event → status mapping ───────────────────────────────────────────────────

const EVENT_TO_STATUS = {
  BatchCreated:       "Collected",
  TestRecorded:       "Tested",
  TestFailed:         "TestFailed",
  BatchProcessed:     "Processed",
  CustodyTransferred: "Distributed",
  BatchRecalled:      "Recalled",
};

const EVENT_NAMES = Object.keys(EVENT_TO_STATUS);

// ─── Block timestamp cache ───────────────────────────────────────────────────

const blockTimestampCache = new Map();

async function getBlockTimestamp(blockNumber) {
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber);
  }
  const block = await provider.getBlock(blockNumber);
  const ts = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
  blockTimestampCache.set(blockNumber, ts);
  return ts;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry(fn, maxRetries = 3, baseDelayMs = 500) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Extract Log Info safely ──────────────────────────────────────────────────

function extractLogInfo(logOrPayload) {
  if (!logOrPayload) {
    return { txHash: `tx-${Date.now()}-${Math.random()}`, blockNumber: 0, index: 0 };
  }
  const log = logOrPayload.log || logOrPayload;
  return {
    txHash: log.transactionHash || logOrPayload.transactionHash || `tx-${Date.now()}`,
    blockNumber: Number(log.blockNumber || logOrPayload.blockNumber || 0),
    index: Number(log.index !== undefined ? log.index : (log.logIndex !== undefined ? log.logIndex : (logOrPayload.index !== undefined ? logOrPayload.index : 0))),
  };
}

// ─── Resolve Parents from Mongo (if available) ─────────────────────────────

async function getParentBatchIds(batchId) {
  if (!batchId) return [];
  try {
    const dbBatch = await BatchModel.findOne({ batchId: batchId });
    return dbBatch?.parentBatchIds || [];
  } catch (e) {
    return [];
  }
}

// ─── Build batch payload for Socket.IO ─────────────────────────────────────────

// ─── Extract actual GPS coordinates from MongoDB batch model ────────────────

function extractCoordinatesFromBatch(b) {
  if (!b) return { lat: null, lng: null, placeName: null, hasGps: false };

  let lat = null;
  let lng = null;
  let placeName = b.farmLocation || b.agreedLocation || b.detectedLocation || null;

  if (b.status === "TRANSFERRED" || b.status === "Distributed") {
    lat = b.transferLocation?.latitude ?? b.processLocation?.latitude ?? b.labLocation?.latitude ?? b.location?.latitude;
    lng = b.transferLocation?.longitude ?? b.processLocation?.longitude ?? b.labLocation?.longitude ?? b.location?.longitude;
  } else if (b.status === "PROCESSED" || b.status === "Processed") {
    lat = b.processLocation?.latitude ?? b.labLocation?.latitude ?? b.location?.latitude;
    lng = b.processLocation?.longitude ?? b.labLocation?.longitude ?? b.location?.longitude;
  } else if (b.status === "TESTED" || b.status === "Tested") {
    lat = b.labLocation?.latitude ?? b.location?.latitude;
    lng = b.labLocation?.longitude ?? b.location?.longitude;
  } else {
    lat = b.location?.latitude ?? b.latitude;
    lng = b.location?.longitude ?? b.longitude;
  }

  const hasGps = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);

  return {
    lat: hasGps ? Number(lat) : null,
    lng: hasGps ? Number(lng) : null,
    placeName,
    hasGps,
  };
}

// ─── Build batch payload for Socket.IO ─────────────────────────────────────────

function buildBatchPayload(batchId, status, owner, dataHash, parents, isLive, customLat = null, customLng = null, customPlace = null) {
  const delayLegs = computeDelayLegs(batchId);
  const delayed   = delayLegs.some((l) => l.status === "Delayed");
  const isActive  = status !== "Distributed";

  const hasGps = customLat != null && customLng != null && !isNaN(customLat) && !isNaN(customLng);
  const coordinateSource = hasGps ? "MONGODB REAL GPS" : "LOCATION UNAVAILABLE";

  const payload = {
    batchId,
    status,
    isActive,
    currentOwner: owner,
    dataHash,
    parents,
    isLive,
    delayed,
    delayLegs: formatLegsForEmission(delayLegs),
    currentLat: hasGps ? customLat : null,
    currentLng: hasGps ? customLng : null,
    placeName: customPlace || null,
    hasGps,
    coordinateSource,
  };

  console.log(`[SOCKET PAYLOAD] batchId=${batchId} stage=${status} lat=${payload.currentLat} lng=${payload.currentLng} source=${coordinateSource}`);
  return payload;
}

// ─── Process event ────────────────────────────────────────────────────────────

function applyEvent({
  eventName, batchId, actorAddress, dataHash,
  txHash, blockNumber, logIndex, blockTimestamp, parents, lat, lng, placeName,
}) {
  const status = EVENT_TO_STATUS[eventName];
  if (!status || !batchId) {
    return false;
  }

  return runTransaction(() => {
    const isNew = insertStageEvent({
      batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex,
    });

    upsertBatch({
      batchId,
      currentStatus: status,
      currentOwner: actorAddress || "0x0000000000000000000000000000000000000000",
      dataHash: typeof dataHash === "string" ? dataHash : (dataHash ? dataHash.toString() : "0x"),
      lastUpdated: blockTimestamp,
      parents: parents || [],
      lat,
      lng,
      placeName,
    });

    return isNew;
  });
}

// ─── Mongo Batch Sync ─────────────────────────────────────────────────────────

async function syncMongoBatchesToDbCache(io) {
  try {
    const mongoBatches = await BatchModel.find().lean();
    if (!mongoBatches || mongoBatches.length === 0) return;

    const STATUS_MAP = {
      CREATED:     "Collected",
      TESTED:      "Tested",
      TEST_FAILED: "TestFailed",
      QUARANTINED: "Quarantined",
      RECALLED:    "Recalled",
      PROCESSED:   "Processed",
      TRANSFERRED: "Distributed",
      DISTRIBUTED: "Distributed",
    };

    const EVENT_MAP = {
      CREATED:     "BatchCreated",
      TESTED:      "TestRecorded",
      TEST_FAILED: "TestFailed",
      QUARANTINED: "TestFailed",
      RECALLED:    "BatchRecalled",
      PROCESSED:   "BatchProcessed",
      TRANSFERRED: "CustodyTransferred",
      DISTRIBUTED: "CustodyTransferred",
    };

    let count = 0;
    for (const b of mongoBatches) {
      if (!b.batchId) continue;
      const status = STATUS_MAP[b.status] || "Collected";
      const eventName = EVENT_MAP[b.status] || "BatchCreated";
      const ts = Math.floor(new Date(b.createdAt || Date.now()).getTime() / 1000);
      const owner = b.farmerWallet || b.labWallet || b.processorWallet || "0x0000000000000000000000000000000000000000";
      const { lat, lng, placeName, hasGps } = extractCoordinatesFromBatch(b);

      const isNew = applyEvent({
        eventName,
        batchId: b.batchId,
        actorAddress: owner,
        dataHash: b.dataHash || "0x",
        txHash: b.txHash || `tx-${b.batchId}`,
        blockNumber: 11759900,
        logIndex: 0,
        blockTimestamp: ts,
        parents: b.parentBatchIds || [],
        lat,
        lng,
        placeName,
      });

      if (isNew) count++;

      if (io) {
        const payload = buildBatchPayload(b.batchId, status, owner, b.dataHash || "0x", b.parentBatchIds || [], true, lat, lng, placeName);
        io.emit("batch:updated", payload);
      }
    }
    console.log(`[SYNC] Synced ${count} MongoDB batches to Digital Twin SQLite cache.`);
  } catch (err) {
    console.warn(`[SYNC] Mongo batch sync warning:`, err.message);
  }
}

function notifyDigitalTwinDirectly(batchDoc, io) {
  if (!batchDoc || !batchDoc.batchId) return;

  const STATUS_MAP = {
    CREATED: "Collected",
    TESTED: "Tested",
    PROCESSED: "Processed",
    TRANSFERRED: "Distributed",
    DISTRIBUTED: "Distributed",
  };

  const EVENT_MAP = {
    CREATED: "BatchCreated",
    TESTED: "TestRecorded",
    PROCESSED: "BatchProcessed",
    TRANSFERRED: "CustodyTransferred",
    DISTRIBUTED: "CustodyTransferred",
  };

  const status = STATUS_MAP[batchDoc.status] || batchDoc.status || "Collected";
  const eventName = EVENT_MAP[batchDoc.status] || "BatchCreated";
  const ts = Math.floor(Date.now() / 1000);
  const owner = batchDoc.farmerWallet || batchDoc.labWallet || batchDoc.processorWallet || batchDoc.newOwner || "0x0000000000000000000000000000000000000000";
  const { lat, lng, placeName } = extractCoordinatesFromBatch(batchDoc);

  applyEvent({
    eventName,
    batchId: batchDoc.batchId,
    actorAddress: owner,
    dataHash: batchDoc.dataHash || "0x",
    txHash: batchDoc.txHash || `tx-${batchDoc.batchId}-${Date.now()}`,
    blockNumber: 11759999,
    logIndex: 0,
    blockTimestamp: ts,
    parents: batchDoc.parentBatchIds || [],
    lat,
    lng,
    placeName,
  });

  const payload = buildBatchPayload(
    batchDoc.batchId,
    status,
    owner,
    batchDoc.dataHash || "0x",
    batchDoc.parentBatchIds || [],
    true,
    lat,
    lng,
    placeName
  );

  const activeIo = io || global.io;
  if (activeIo) {
    activeIo.emit("batch:updated", payload);
    console.log(`[SYNC] 🚀 Digital Twin notified directly for batch ${batchDoc.batchId} (${status}) — lat:${lat} lng:${lng}`);
  }
}

// ─── Historical sync ──────────────────────────────────────────────────────────

async function runHistoricalSync(io) {
  console.log("[SYNC] Starting historical sync…");

  // First sync all existing batches from MongoDB into SQLite cache
  await syncMongoBatchesToDbCache(io);

  const latestBlock = await withRetry(() => provider.getBlockNumber());
  let fromBlock = getLastSyncedBlock();

  if (fromBlock === null) {
    // Scan recent 50 blocks by default for Alchemy free tier compliance
    fromBlock = Math.max(0, latestBlock - 50);
    console.log(`[SYNC] Initial sync: scanning recent 50 blocks starting from block ${fromBlock}.`);
  } else {
    fromBlock = fromBlock + 1;
    console.log(`[SYNC] Resuming sync from block ${fromBlock}.`);
  }

  let totalEventsProcessed = 0;

  for (let chunkStart = fromBlock; chunkStart <= latestBlock; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, latestBlock);

    // Throttle RPC queries to respect rate limits
    await new Promise((r) => setTimeout(r, 250));

    const filters = EVENT_NAMES.map((eventName) =>
      withRetry(() => contract.queryFilter(contract.filters[eventName](), chunkStart, chunkEnd))
    );

    let allLogs;
    try {
      allLogs = await Promise.all(filters);
    } catch (err) {
      console.warn(`[SYNC] Chunk ${chunkStart}–${chunkEnd} query failed: ${err.message}.`);
      continue; // Continue to next chunk rather than breaking entire sync loop
    }

    const flatLogs = allLogs
      .flat()
      .sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

    if (flatLogs.length > 0) {
      const uniqueBlocks = [...new Set(flatLogs.map((l) => l.blockNumber))];
      await Promise.all(uniqueBlocks.map(getBlockTimestamp));

      for (const log of flatLogs) {
        const blockTimestamp = await getBlockTimestamp(log.blockNumber);
        const eventName = log.fragment?.name || log.event;

        if (!EVENT_TO_STATUS[eventName]) continue;

        const batchId      = log.args[0];
        const actorAddress = log.args[1];
        const dataHash     = log.args[2];
        const parents      = await getParentBatchIds(batchId);

        const isNew = applyEvent({
          eventName,
          batchId,
          actorAddress,
          dataHash,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          logIndex: log.index,
          blockTimestamp,
          parents,
        });

        if (isNew) totalEventsProcessed++;
      }
    }

    setLastSyncedBlock(chunkEnd);
  }

  console.log(`[SYNC] Historical sync complete. ${totalEventsProcessed} new events stored in cache.`);
  console.log(`[SYNC] Total batches active in Digital Twin: ${getAllBatches().length}`);
}

// ─── Process & Broadcast live event ─────────────────────────────────────────────

async function processAndEmitLiveEvent(eventName, batchId, actorAddress, dataHash, rawLog, io) {
  try {
    const { txHash, blockNumber, index: logIndex } = extractLogInfo(rawLog);
    const blockTimestamp = await getBlockTimestamp(blockNumber);
    const parents = await getParentBatchIds(batchId);

    if (!batchId) return;

    const isNew = applyEvent({
      eventName,
      batchId,
      actorAddress,
      dataHash,
      txHash,
      blockNumber,
      logIndex,
      blockTimestamp,
      parents,
    });

    if (!isNew) return;

    console.log(`[SYNC] 🚀 LIVE BLOCKCHAIN EVENT: ${eventName} batchId=${batchId} block=${blockNumber}`);

    if (blockNumber > 0) setLastSyncedBlock(blockNumber);

    const status = EVENT_TO_STATUS[eventName];
    const batch  = require("./dbCache").getBatchById(batchId);
    const payload = buildBatchPayload(
      batchId, status, actorAddress,
      typeof dataHash === "string" ? dataHash : (dataHash ? dataHash.toString() : "0x"),
      batch ? batch.parents : parents,
      true
    );

    io.emit("batch:updated", payload);

    const stageEvents = getStageEvents(batchId);
    if (stageEvents.length >= 2) {
      const prevEvent = stageEvents[stageEvents.length - 2];
      const prevStatus = EVENT_TO_STATUS[prevEvent.eventName];
      const legKey = getLegForTransition(prevStatus, status);
      if (legKey) {
        startSimulation({ batchId, legKey, io });
      }
    }
  } catch (err) {
    console.error(`[SYNC] Error processing live event ${eventName} for ${batchId}:`, err.message);
  }
}

// ─── Periodic Poll Loop for Guaranteed Sync ────────────────────────────────────

let pollTimer = null;

function startLivePolling(io, pollIntervalMs = 3000) {
  if (pollTimer) clearInterval(pollTimer);

  console.log(`[SYNC] Starting 3s live block poll loop to catch any unnotified on-chain events…`);

  pollTimer = setInterval(async () => {
    try {
      const latestBlock = await provider.getBlockNumber();
      let lastSynced = getLastSyncedBlock();

      if (lastSynced === null) return;
      if (latestBlock <= lastSynced) return;

      const fromBlock = lastSynced + 1;
      const toBlock   = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock);

      const filters = EVENT_NAMES.map((eventName) =>
        contract.queryFilter(contract.filters[eventName](), fromBlock, toBlock)
      );

      const allLogs = await Promise.all(filters);
      const flatLogs = allLogs
        .flat()
        .sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

      for (const log of flatLogs) {
        const eventName    = log.fragment?.name || log.event;
        const batchId      = log.args[0];
        const actorAddress = log.args[1];
        const dataHash     = log.args[2];

        await processAndEmitLiveEvent(eventName, batchId, actorAddress, dataHash, log, io);
      }

      setLastSyncedBlock(toBlock);
    } catch (err) {
      // Quiet retry during background poll
    }
  }, pollIntervalMs);
}

// ─── Live listeners ───────────────────────────────────────────────────────────

function attachLiveListeners(io) {
  console.log("[SYNC] Attaching live contract event listeners…");

  contract.on("BatchCreated", (batchId, farmer, dataHash, log) => {
    processAndEmitLiveEvent("BatchCreated", batchId, farmer, dataHash, log, io);
  });

  contract.on("TestRecorded", (batchId, lab, dataHash, log) => {
    processAndEmitLiveEvent("TestRecorded", batchId, lab, dataHash, log, io);
  });

  contract.on("BatchProcessed", (batchId, processor, dataHash, log) => {
    processAndEmitLiveEvent("BatchProcessed", batchId, processor, dataHash, log, io);
  });

  contract.on("CustodyTransferred", (batchId, newOwner, dataHash, log) => {
    processAndEmitLiveEvent("CustodyTransferred", batchId, newOwner, dataHash, log);
  });

  startLivePolling(io, 3000);

  console.log("[SYNC] Live listeners & 3s polling loop active for: BatchCreated, TestRecorded, BatchProcessed, CustodyTransferred.");
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

function buildSnapshot(allRoutes) {
  const batches = getAllBatches();

  return batches.map((batch) => {
    const delayLegs = computeDelayLegs(batch.batchId);
    const delayed   = delayLegs.some((l) => l.status === "Delayed");
    const routesByLeg = allRoutes || {};
    const isActive  = batch.currentStatus !== "Distributed";

    const finalLat  = batch.lat != null ? batch.lat : null;
    const finalLng  = batch.lng != null ? batch.lng : null;

    return {
      batchId:      batch.batchId,
      status:       batch.currentStatus,
      isActive,
      currentOwner: batch.currentOwner,
      dataHash:     batch.dataHash,
      parents:      batch.parents,
      lastUpdated:  batch.lastUpdated,
      isLive:       false,
      delayed,
      delayLegs:    formatLegsForEmission(delayLegs),
      currentLat:   finalLat,
      currentLng:   finalLng,
      placeName:    batch.placeName || null,
      hasGps:       finalLat != null && finalLng != null,
      routes:       routesByLeg,
    };
  });
}

module.exports = {
  runHistoricalSync,
  attachLiveListeners,
  buildSnapshot,
  notifyDigitalTwinDirectly,
  syncMongoBatchesToDbCache,
  provider,
};
