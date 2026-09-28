/**
 * ============================================================
 * HerbTrace — Lineage-Based Recall Service
 * ============================================================
 *
 * Purpose:
 *   If a batch is found to be contaminated or unsafe, trace all
 *   descendant batches through the existing parentBatchIds /
 *   chainId lineage and mark each one as RECALLED.
 *
 * Design decisions:
 *   - Uses existing `parentBatchIds` array and `chainId` field
 *     already present in every Batch document.
 *   - Traversal is BFS through Batch.parentBatchIds edges.
 *   - On-chain recall is performed for each affected batch via
 *     the contract's `recallBatch()` admin function.
 *   - Records are NOT deleted; historical data is preserved.
 *   - If on-chain call fails, MongoDB is still updated (best-effort).
 *
 * On-chain vs. off-chain:
 *   - The contract's recallBatch() enforces the Recalled state
 *     on-chain (no further processBatch or transferCustody allowed).
 *   - MongoDB is also updated for API-level consistency.
 *
 * Usage:
 *   const { recallBatchWithLineage } = require('./recallService');
 *   const result = await recallBatchWithLineage(rootBatchId, reason, adminUserId);
 *
 * ============================================================
 */

const Batch = require('../models/Batch');
const { getContract } = require('./blockchainService');

// Status values that are already terminal — stop traversal at these
const TERMINAL_STATUSES = new Set(['RECALLED']);

/**
 * Build a map of batchId -> [child batchIds] by scanning all
 * batches that list the given seeds in their parentBatchIds.
 *
 * @param {string[]} seedIds  Initial batch IDs to find children for
 * @returns {Promise<Map<string, string[]>>}  parent→children adjacency
 */
const buildChildMap = async (seedIds) => {
  const childMap = new Map();

  // Find all batches in the same lineage chain(s)
  // Strategy: collect chainIds of seeds, then find all batches with those chainIds
  const seedBatches = await Batch.find({ batchId: { $in: seedIds } }, { batchId: 1, chainId: 1 });
  const chainIds = [...new Set(seedBatches.map(b => b.chainId || b.batchId).filter(Boolean))];

  // Pull all batches that share the chain(s) — this is a bounded set
  const allChainBatches = await Batch.find(
    { chainId: { $in: chainIds } },
    { batchId: 1, parentBatchIds: 1, chainId: 1, status: 1 }
  );

  // Build child-map from parentBatchIds edges
  for (const batch of allChainBatches) {
    if (!childMap.has(batch.batchId)) childMap.set(batch.batchId, []);
    for (const parentId of (batch.parentBatchIds || [])) {
      if (!childMap.has(parentId)) childMap.set(parentId, []);
      childMap.get(parentId).push(batch.batchId);
    }
  }

  return { childMap, allChainBatches };
};

/**
 * BFS traversal from a root batch — returns all descendant batchIds
 * (including the root) reachable through the parentBatchIds graph.
 *
 * @param {string}   rootBatchId
 * @param {Map}      childMap  parent→[children] adjacency
 * @returns {Set<string>}
 */
const collectDescendants = (rootBatchId, childMap) => {
  const visited = new Set();
  const queue = [rootBatchId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const children = childMap.get(current) || [];
    for (const child of children) {
      if (!visited.has(child)) queue.push(child);
    }
  }

  return visited;
};

/**
 * Mark a single batch as RECALLED in MongoDB.
 * Returns { ok: true } or { ok: false, error }.
 */
const mongoose = require('mongoose');

const recallInMongo = async (batchId, reason, adminUserId) => {
  try {
    const update = {
      status: 'RECALLED',
      recallReason: reason,
      recalledAt: new Date(),
    };
    if (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) {
      update.recalledBy = adminUserId;
    }
    const result = await Batch.findOneAndUpdate(
      { batchId },
      update,
      { returnDocument: 'after' }
    );
    if (!result) return { ok: false, error: 'Batch not found in MongoDB' };
    return { ok: true, doc: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

/**
 * Mark a single batch as RECALLED on-chain using the admin wallet.
 * Returns { ok: true, txHash } or { ok: false, error }.
 */
const recallOnChain = async (batchId, reason) => {
  try {
    const adminContract = getContract('admin');
    const tx = await adminContract.recallBatch(batchId, reason);
    const receipt = await tx.wait();
    return { ok: true, txHash: receipt.hash };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

/**
 * Recall a batch and all its lineage descendants.
 *
 * @param {string} rootBatchId  The batch to start recall from
 * @param {string} reason       Human-readable recall reason
 * @param {string} [adminUserId] MongoDB ObjectId of the admin initiating the recall
 * @returns {Promise<RecallResult>}
 *
 * RecallResult {
 *   rootBatchId,
 *   reason,
 *   affectedBatchIds: string[],    // all batchIds affected
 *   mongoRecalls: [{ batchId, ok, error? }],
 *   chainRecalls: [{ batchId, ok, txHash?, error? }],
 *   errors: string[],
 *   timestamp: ISO string
 * }
 */
const recallBatchWithLineage = async (rootBatchId, reason, adminUserId = null) => {
  const result = {
    rootBatchId,
    reason,
    affectedBatchIds: [],
    mongoRecalls: [],
    chainRecalls: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  // ── Validate root exists ───────────────────────────────────────────────────
  const rootBatch = await Batch.findOne({ batchId: rootBatchId }, { batchId: 1, status: 1, chainId: 1 });
  if (!rootBatch) {
    result.errors.push(`Root batch "${rootBatchId}" not found in MongoDB`);
    return result;
  }

  if (TERMINAL_STATUSES.has(rootBatch.status)) {
    result.errors.push(`Batch "${rootBatchId}" is already RECALLED`);
    result.affectedBatchIds = [rootBatchId];
    return result;
  }

  // ── Build lineage graph ────────────────────────────────────────────────────
  const { childMap } = await buildChildMap([rootBatchId]);

  // ── Collect all descendants ────────────────────────────────────────────────
  const affectedSet = collectDescendants(rootBatchId, childMap);
  result.affectedBatchIds = [...affectedSet];

  // ── Recall each affected batch ─────────────────────────────────────────────
  for (const batchId of affectedSet) {
    // MongoDB recall
    const mongoResult = await recallInMongo(batchId, reason, adminUserId);
    result.mongoRecalls.push({ batchId, ...mongoResult });
    if (!mongoResult.ok) {
      result.errors.push(`MongoDB recall failed for ${batchId}: ${mongoResult.error}`);
    }

    // On-chain recall (best-effort — failures are logged but don't abort)
    const chainResult = await recallOnChain(batchId, reason);
    result.chainRecalls.push({ batchId, ...chainResult });
    if (!chainResult.ok) {
      // On-chain failures are expected for batches not yet on-chain
      // (e.g. processed batches where only MongoDB exists)
      result.errors.push(`On-chain recall failed for ${batchId}: ${chainResult.error}`);
    }
  }

  return result;
};

/**
 * Check if a batch is in a recalled (or otherwise blocked) state.
 * Returns { recalled: boolean, status: string }.
 */
const isBatchRecalled = async (batchId) => {
  const batch = await Batch.findOne({ batchId }, { status: 1 });
  if (!batch) return { recalled: false, status: null, notFound: true };
  const recalled = batch.status === 'RECALLED' || batch.status === 'QUARANTINED' || batch.status === 'TEST_FAILED';
  return { recalled, status: batch.status };
};

/**
 * Get all batches in the same lineage chain as the given batchId.
 * Useful for audit / verification.
 *
 * @param {string} batchId
 * @returns {Promise<Batch[]>}
 */
const getLineage = async (batchId) => {
  const batch = await Batch.findOne({ batchId }, { chainId: 1 });
  if (!batch) return [];
  const chainId = batch.chainId || batchId;
  return Batch.find({ chainId }, { batchId: 1, status: 1, parentBatchIds: 1, chainId: 1 }).sort({ createdAt: 1 });
};

module.exports = {
  recallBatchWithLineage,
  isBatchRecalled,
  getLineage,
  buildChildMap,
  collectDescendants,
};
