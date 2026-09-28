/**
 * ============================================================
 * HerbTrace — Blockchain ↔ MongoDB Reconciliation Service
 * ============================================================
 *
 * Purpose:
 *   Detect inconsistencies between MongoDB Batch records and the
 *   authoritative on-chain state stored in the HerbTrace smart contract.
 *
 * Design:
 *   - DETECTION-ONLY: this service does NOT automatically overwrite data.
 *   - Each reconciliation result is classified as CONSISTENT or INCONSISTENT.
 *   - Inconsistencies include field-level details, severity, and timestamps.
 *   - The service fails safely: RPC or MongoDB errors are caught and reported.
 *
 * Comparable fields:
 *   MongoDB          On-chain (getBatch)
 *   ─────────────── ─────────────────────
 *   batchId          batch.batchId
 *   status           batch.status (0=Created…6=Recalled)
 *   dataHash         batch.dataHash
 *   txHash           N/A (not stored on-chain, compared to parent ancestry)
 *   parentBatchIds   getParents(batchId)
 *
 * Status mapping (MongoDB → Solidity enum index):
 *   CREATED=0, TESTED=1, PROCESSED=2, TRANSFERRED=3,
 *   TEST_FAILED=4, QUARANTINED=5, RECALLED=6
 *
 * ============================================================
 */

const Batch = require('../models/Batch');
const { getContract } = require('./blockchainService');

// Status index mapping: MongoDB string → on-chain uint8
const MONGO_TO_CHAIN_STATUS = {
  CREATED:     0,
  TESTED:      1,
  PROCESSED:   2,
  TRANSFERRED: 3,
  TEST_FAILED: 4,
  QUARANTINED: 5,
  RECALLED:    6,
};

const CHAIN_TO_MONGO_STATUS = Object.fromEntries(
  Object.entries(MONGO_TO_CHAIN_STATUS).map(([k, v]) => [v, k])
);

/**
 * Fetch on-chain batch state for a given batchId.
 * Returns { ok: true, data } or { ok: false, error }.
 */
const fetchOnChainBatch = async (batchId) => {
  try {
    // Use a read-only contract view — any role wallet works for view calls
    const contract = getContract('admin');
    const onChain = await contract.getBatch(batchId);
    const parents = await contract.getParents(batchId);

    return {
      ok: true,
      data: {
        batchId:       onChain.batchId,
        owner:         onChain.currentOwner,
        statusIndex:   Number(onChain.status),
        statusName:    CHAIN_TO_MONGO_STATUS[Number(onChain.status)] || `UNKNOWN(${Number(onChain.status)})`,
        dataHash:      onChain.dataHash,
        lastUpdated:   Number(onChain.lastUpdated),
        parents:       parents,
      },
    };
  } catch (err) {
    // "Batch not found" is a contract revert — batch does not exist on-chain
    if (err.message && (err.message.includes('Batch not found') || err.message.includes('execution reverted'))) {
      return { ok: false, notFound: true, error: 'Batch not found on-chain' };
    }
    // Any other error (RPC failure, timeout, etc.)
    return { ok: false, rpcError: true, error: err.message };
  }
};

/**
 * Compare a single MongoDB Batch document against on-chain state.
 *
 * @param {string|object} batchIdOrDoc  batchId string, or a Batch Mongoose document
 * @returns {Promise<ReconciliationResult>}
 *
 * ReconciliationResult {
 *   batchId: string,
 *   status: 'CONSISTENT' | 'INCONSISTENT' | 'MISSING_MONGO' | 'MISSING_CHAIN' | 'ERROR',
 *   inconsistencies: [ { field, mongoValue, chainValue, severity } ],
 *   mongoDoc:  { ... } | null,
 *   chainData: { ... } | null,
 *   error?: string,
 *   timestamp: ISO string
 * }
 */
const reconcileBatch = async (batchIdOrDoc) => {
  const timestamp = new Date().toISOString();
  let mongoBatch = null;
  let batchId;

  // ── Resolve the MongoDB document ─────────────────────────────────────────
  try {
    if (typeof batchIdOrDoc === 'string') {
      batchId = batchIdOrDoc;
      mongoBatch = await Batch.findOne({ batchId }).lean();
    } else {
      // Mongoose doc or plain object
      mongoBatch = batchIdOrDoc.toObject ? batchIdOrDoc.toObject() : batchIdOrDoc;
      batchId = mongoBatch.batchId;
    }
  } catch (err) {
    return {
      batchId: String(batchIdOrDoc),
      status: 'ERROR',
      inconsistencies: [],
      mongoDoc: null,
      chainData: null,
      error: `MongoDB query failed: ${err.message}`,
      timestamp,
    };
  }

  // ── Missing from MongoDB ─────────────────────────────────────────────────
  if (!mongoBatch) {
    // Still try on-chain
    const chainResult = await fetchOnChainBatch(batchId);
    return {
      batchId,
      status: 'MISSING_MONGO',
      inconsistencies: [{
        field:       'batchId',
        mongoValue:  null,
        chainValue:  chainResult.ok ? chainResult.data.batchId : 'UNKNOWN',
        severity:    'HIGH',
      }],
      mongoDoc:  null,
      chainData: chainResult.ok ? chainResult.data : null,
      error:     !chainResult.ok ? chainResult.error : undefined,
      timestamp,
    };
  }

  // ── Fetch on-chain state ─────────────────────────────────────────────────
  const chainResult = await fetchOnChainBatch(batchId);

  // ── RPC error ────────────────────────────────────────────────────────────
  if (chainResult.rpcError) {
    return {
      batchId,
      status: 'ERROR',
      inconsistencies: [],
      mongoDoc:  { batchId: mongoBatch.batchId, status: mongoBatch.status, dataHash: mongoBatch.dataHash },
      chainData: null,
      error:     `RPC failure: ${chainResult.error}`,
      timestamp,
    };
  }

  // ── Missing from chain ────────────────────────────────────────────────────
  if (chainResult.notFound) {
    return {
      batchId,
      status: 'MISSING_CHAIN',
      inconsistencies: [{
        field:       'batchId',
        mongoValue:  mongoBatch.batchId,
        chainValue:  null,
        severity:    'HIGH',
      }],
      mongoDoc:  { batchId: mongoBatch.batchId, status: mongoBatch.status, dataHash: mongoBatch.dataHash },
      chainData: null,
      error:     chainResult.error,
      timestamp,
    };
  }

  // ── Field-by-field comparison ─────────────────────────────────────────────
  const inconsistencies = [];
  const chain = chainResult.data;

  // 1. Status
  const mongoStatusIndex = MONGO_TO_CHAIN_STATUS[mongoBatch.status];
  if (mongoStatusIndex !== chain.statusIndex) {
    inconsistencies.push({
      field:       'status',
      mongoValue:  mongoBatch.status,
      chainValue:  chain.statusName,
      severity:    'HIGH',
      detail:      `MongoDB index=${mongoStatusIndex}, on-chain index=${chain.statusIndex}`,
    });
  }

  // 2. dataHash — stored as hex string in Mongo, as bytes32 on-chain
  const mongoHash = mongoBatch.dataHash
    ? (mongoBatch.dataHash.startsWith('0x') ? mongoBatch.dataHash : `0x${mongoBatch.dataHash}`)
    : null;
  const chainHash = chain.dataHash; // ethers returns bytes32 with 0x prefix

  if (mongoHash && chainHash && mongoHash.toLowerCase() !== chainHash.toLowerCase()) {
    inconsistencies.push({
      field:      'dataHash',
      mongoValue: mongoHash,
      chainValue: chainHash,
      severity:   'CRITICAL',
      detail:     'Data integrity mismatch — hash values differ',
    });
  }

  // 3. parentBatchIds vs on-chain parents
  const mongoParents = (mongoBatch.parentBatchIds || []).sort();
  const chainParents = (chain.parents || []).sort();
  const parentsMatch = JSON.stringify(mongoParents) === JSON.stringify(chainParents);
  if (!parentsMatch) {
    inconsistencies.push({
      field:      'parentBatchIds',
      mongoValue: mongoParents,
      chainValue: chainParents,
      severity:   'MEDIUM',
      detail:     'Parent batch references differ',
    });
  }

  // 4. txHash — not stored on-chain, but check if txHash is present in MongoDB when chain record exists
  if (!mongoBatch.txHash && chain.lastUpdated > 0) {
    inconsistencies.push({
      field:      'txHash',
      mongoValue: null,
      chainValue: 'EXISTS (on-chain lastUpdated is non-zero)',
      severity:   'LOW',
      detail:     'MongoDB is missing txHash for a batch that exists on-chain',
    });
  }

  const consistent = inconsistencies.length === 0;

  return {
    batchId,
    status:          consistent ? 'CONSISTENT' : 'INCONSISTENT',
    inconsistencies,
    mongoDoc: {
      batchId:        mongoBatch.batchId,
      status:         mongoBatch.status,
      dataHash:       mongoBatch.dataHash,
      txHash:         mongoBatch.txHash || null,
      parentBatchIds: mongoBatch.parentBatchIds || [],
      chainId:        mongoBatch.chainId || null,
    },
    chainData: {
      batchId:     chain.batchId,
      statusIndex: chain.statusIndex,
      statusName:  chain.statusName,
      dataHash:    chain.dataHash,
      owner:       chain.owner,
      parents:     chain.parents,
      lastUpdated: chain.lastUpdated,
    },
    timestamp,
  };
};

/**
 * Reconcile all batches in MongoDB against on-chain state.
 *
 * NOTE: This is potentially slow for large datasets.
 * Processes batches in sequence to avoid RPC rate-limiting.
 *
 * @param {object} [options]
 * @param {number} [options.limit=100]   Max batches to reconcile
 * @param {number} [options.skip=0]      Pagination offset
 * @returns {Promise<BulkReconciliationResult>}
 */
const reconcileAllBatches = async (options = {}) => {
  const { limit = 100, skip = 0 } = options;
  const startTime = Date.now();

  let batches;
  try {
    batches = await Batch.find({}, { batchId: 1, status: 1, dataHash: 1, txHash: 1, parentBatchIds: 1, chainId: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
  } catch (err) {
    return {
      status:   'ERROR',
      error:    `MongoDB query failed: ${err.message}`,
      results:  [],
      summary:  { total: 0, consistent: 0, inconsistent: 0, errors: 0 },
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  const results = [];
  for (const batch of batches) {
    const result = await reconcileBatch(batch);
    results.push(result);
  }

  const summary = {
    total:        results.length,
    consistent:   results.filter(r => r.status === 'CONSISTENT').length,
    inconsistent: results.filter(r => r.status === 'INCONSISTENT').length,
    missingMongo: results.filter(r => r.status === 'MISSING_MONGO').length,
    missingChain: results.filter(r => r.status === 'MISSING_CHAIN').length,
    errors:       results.filter(r => r.status === 'ERROR').length,
  };

  return {
    status:     'COMPLETED',
    results,
    summary,
    durationMs: Date.now() - startTime,
    timestamp:  new Date().toISOString(),
  };
};

module.exports = {
  reconcileBatch,
  reconcileAllBatches,
  fetchOnChainBatch,
  MONGO_TO_CHAIN_STATUS,
  CHAIN_TO_MONGO_STATUS,
};
