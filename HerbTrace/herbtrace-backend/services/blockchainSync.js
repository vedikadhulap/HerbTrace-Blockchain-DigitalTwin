/**
 * blockchainSync.js — Ethereum event sync for HerbTrace Digital Twin.
 *
 * Responsibilities:
 *   1. Historical sync: queryFilter from last synced block → latest, in chunks.
 *   2. Persist events to SQLite (dbCache). Dedupe by (txHash, logIndex).
 *   3. Resolve block timestamps via provider.getBlock (with local cache).
 *   4. Attach live contract event listeners for HerbTrace.sol events.
 *   5. For live events: update DB, compute delay legs, emit batch:updated via Socket.IO.
 *   6. Trigger location simulator for live stage transitions.
 *
 * Read-only interface with HerbTrace smart contract.
 * Contract events → Digital Twin status mapping:
 *   BatchCreated       → "Collected"
 *   TestRecorded       → "Tested"
 *   BatchProcessed     → "Processed"
 *   CustodyTransferred  → "Distributed"
 */

const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");
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

// Config
const DEPLOY_BLOCK  = parseInt(process.env.CONTRACT_DEPLOY_BLOCK || "0", 10);
const CHUNK_SIZE    = parseInt(process.env.SYNC_CHUNK_SIZE || "2000", 10);
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS;
const RPC_URL       = process.env.ALCHEMY_RPC_URL || process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";

// Load ABI
let contractABI = [];
try {
  const abiPath = path.resolve(__dirname, "../abi/HerbTrace.json");
  if (fs.existsSync(abiPath)) {
    const artifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    contractABI = artifact.abi || artifact;
  }
} catch (err) {
  console.warn("[SYNC] Warning loading contract ABI:", err.message);
}

let provider;
let contract;

if (RPC_URL && CONTRACT_ADDR && contractABI.length > 0) {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    contract = new ethers.Contract(CONTRACT_ADDR, contractABI, provider);
  } catch (e) {
    console.warn("[SYNC] Could not instantiate Ethers provider/contract:", e.message);
  }
}

const EVENT_TO_STATUS = {
  BatchCreated:       "Collected",
  TestRecorded:       "Tested",
  BatchProcessed:     "Processed",
  CustodyTransferred: "Distributed",
};

const EVENT_NAMES = Object.keys(EVENT_TO_STATUS);
const blockTimestampCache = new Map();

async function getBlockTimestamp(blockNumber) {
  if (!provider) return Math.floor(Date.now() / 1000);
  if (blockTimestampCache.has(blockNumber)) {
    return blockTimestampCache.get(blockNumber);
  }
  try {
    const block = await provider.getBlock(blockNumber);
    const ts = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
    blockTimestampCache.set(blockNumber, ts);
    return ts;
  } catch (err) {
    return Math.floor(Date.now() / 1000);
  }
}

async function withRetry(fn, maxRetries = 2, baseDelayMs = 500) {
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

function buildBatchPayload(batchId, status, owner, dataHash, parents, isLive) {
  const delayLegs = computeDelayLegs(batchId);
  const delayed   = delayLegs.some((l) => l.status === "Delayed");
  const pos       = getStaticPosition(status);

  return {
    batchId,
    status,
    currentOwner: owner,
    dataHash,
    parents,
    isLive,
    delayed,
    delayLegs: formatLegsForEmission(delayLegs),
    currentLat: pos ? pos.lat : null,
    currentLng: pos ? pos.lng : null,
  };
}

function applyEvent({
  eventName, batchId, actorAddress, dataHash,
  txHash, blockNumber, logIndex, blockTimestamp, parents,
}) {
  const status = EVENT_TO_STATUS[eventName];
  if (!status) return false;

  return runTransaction(() => {
    const isNew = insertStageEvent({
      batchId, eventName, blockNumber, blockTimestamp, txHash, logIndex,
    });

    if (!isNew) return false;

    upsertBatch({
      batchId,
      currentStatus: status,
      currentOwner: actorAddress,
      dataHash: typeof dataHash === "string" ? dataHash : dataHash ? dataHash.toString() : "",
      lastUpdated: blockTimestamp,
      parents: parents || [],
    });

    return true;
  });
}

async function runHistoricalSync(io) {
  if (!provider || !contract) {
    console.warn("[SYNC] Provider/contract uninitialized. Skipping historical blockchain sync.");
    return;
  }

  console.log("[SYNC] Starting read-only historical sync…");

  let fromBlock = getLastSyncedBlock();
  if (fromBlock === null) {
    fromBlock = DEPLOY_BLOCK || 0;
  } else {
    fromBlock = fromBlock + 1;
  }

  let latestBlock;
  try {
    latestBlock = await withRetry(() => provider.getBlockNumber());
  } catch (err) {
    console.warn(`[SYNC] RPC provider offline or unreachable: ${err.message}. Digital Twin will rely on cached state.`);
    return;
  }

  if (fromBlock > latestBlock) {
    console.log(`[SYNC] Already synced up to block ${latestBlock}.`);
    return;
  }

  console.log(`[SYNC] Latest block: ${latestBlock}. Syncing from block ${fromBlock} in chunks of ${CHUNK_SIZE}.`);
  let totalEventsProcessed = 0;

  for (let chunkStart = fromBlock; chunkStart <= latestBlock; chunkStart += CHUNK_SIZE) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE - 1, latestBlock);

    try {
      const filters = EVENT_NAMES.map((eventName) =>
        contract.filters[eventName] ? contract.filters[eventName]() : null
      ).filter(Boolean);

      const allLogs = await Promise.all(
        filters.map((filter) => withRetry(() => contract.queryFilter(filter, chunkStart, chunkEnd)))
      );

      const flatLogs = allLogs
        .flat()
        .sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

      if (flatLogs.length > 0) {
        const uniqueBlocks = [...new Set(flatLogs.map((l) => l.blockNumber))];
        await Promise.all(uniqueBlocks.map(getBlockTimestamp));

        for (const log of flatLogs) {
          const blockTimestamp = await getBlockTimestamp(log.blockNumber);
          const eventName = log.fragment?.name || log.event;

          let batchId, actorAddress, dataHash, parents = [];
          if (log.args && log.args.length >= 3) {
            batchId      = log.args[0];
            actorAddress = log.args[1];
            dataHash     = log.args[2];
          } else {
            continue;
          }

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
    } catch (err) {
      console.warn(`[SYNC] Warning during block chunk ${chunkStart}–${chunkEnd}: ${err.message}`);
      break;
    }
  }

  console.log(`[SYNC] Historical sync complete. ${totalEventsProcessed} events synced.`);
}

function attachLiveListeners(io) {
  if (!contract) return;
  console.log("[SYNC] Attaching read-only live event listeners…");

  async function handleLiveEvent(eventName, batchId, actorAddress, dataHash, log) {
    try {
      const blockTimestamp = await getBlockTimestamp(log.blockNumber);

      const isNew = applyEvent({
        eventName,
        batchId,
        actorAddress,
        dataHash,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        blockTimestamp,
        parents: [],
      });

      if (!isNew) return;

      console.log(`[SYNC] LIVE event detected: ${eventName} batchId=${batchId}`);
      setLastSyncedBlock(log.blockNumber);

      const status = EVENT_TO_STATUS[eventName];
      const batch  = require("./dbCache").getBatchById(batchId);
      const payload = buildBatchPayload(
        batchId, status, actorAddress,
        typeof dataHash === "string" ? dataHash : dataHash ? dataHash.toString() : "",
        batch ? batch.parents : [],
        true
      );

      if (io) {
        io.emit("batch:updated", payload);
      }

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
      console.error(`[SYNC] Error handling live event ${eventName}:`, err.message);
    }
  }

  try {
    contract.on("BatchCreated", (batchId, farmer, dataHash, log) => {
      handleLiveEvent("BatchCreated", batchId, farmer, dataHash, log);
    });

    contract.on("TestRecorded", (batchId, lab, dataHash, log) => {
      handleLiveEvent("TestRecorded", batchId, lab, dataHash, log);
    });

    contract.on("BatchProcessed", (batchId, processor, dataHash, log) => {
      handleLiveEvent("BatchProcessed", batchId, processor, dataHash, log);
    });

    contract.on("CustodyTransferred", (batchId, newOwner, dataHash, log) => {
      handleLiveEvent("CustodyTransferred", batchId, newOwner, dataHash, log);
    });
  } catch (err) {
    console.warn("[SYNC] Unable to attach live WebSocket contract listeners:", err.message);
  }
}

function buildSnapshot(allRoutes) {
  const batches = getAllBatches();

  return batches.map((batch) => {
    const delayLegs = computeDelayLegs(batch.batchId);
    const delayed   = delayLegs.some((l) => l.status === "Delayed");
    const pos       = getStaticPosition(batch.currentStatus);

    return {
      batchId:      batch.batchId,
      status:       batch.currentStatus,
      currentOwner: batch.currentOwner,
      dataHash:     batch.dataHash,
      parents:      batch.parents,
      lastUpdated:  batch.lastUpdated,
      isLive:       false,
      delayed,
      delayLegs:    formatLegsForEmission(delayLegs),
      currentLat:   pos ? pos.lat : null,
      currentLng:   pos ? pos.lng : null,
      routes:       allRoutes || {},
    };
  });
}

module.exports = {
  runHistoricalSync,
  attachLiveListeners,
  buildSnapshot,
};
