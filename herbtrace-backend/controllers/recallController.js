/**
 * ============================================================
 * HerbTrace — Recall & Reconciliation Controllers
 * ============================================================
 */

const batchService = require('../services/batchService');
const { reconcileBatch, reconcileAllBatches } = require('../services/reconciliationService');

// ── Recall Controller ─────────────────────────────────────────────────────────

/**
 * POST /batch/recall
 * Body: { batchId, reason }
 * Role: admin only
 *
 * Recalls a batch and all its lineage descendants.
 */
const recallBatch = async (req, res) => {
  try {
    const { batchId, reason } = req.body;

    if (!batchId || !reason) {
      return res.status(400).json({ error: 'batchId and reason are required' });
    }

    // Role check — admin only
    if (req.user && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin users can initiate a recall' });
    }

    const adminUserId = req.user?.userId || null;
    const result = await batchService.recallBatchWithLineage(batchId, reason, adminUserId);

    if (result.errors.length > 0 && result.affectedBatchIds.length === 0) {
      // Root not found
      return res.status(404).json({ error: result.errors[0], result });
    }

    const httpStatus = result.errors.length > 0 ? 207 : 200; // 207 = Multi-Status (partial success)
    return res.status(httpStatus).json({
      message: `Recall initiated for batch ${batchId} and ${result.affectedBatchIds.length - 1} descendant(s)`,
      ...result,
    });
  } catch (error) {
    console.error('recallBatch controller error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /batch/:batchId/lineage
 * Returns all batches in the same lineage chain.
 */
const getLineage = async (req, res) => {
  try {
    const { batchId } = req.params;
    const lineage = await batchService.getLineage(batchId);
    return res.status(200).json({ batchId, lineageCount: lineage.length, lineage });
  } catch (error) {
    console.error('getLineage controller error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /batch/:batchId/recall-status
 * Returns whether a batch is in a blocked (recalled/failed) state.
 */
const getRecallStatus = async (req, res) => {
  try {
    const { batchId } = req.params;
    const status = await batchService.isBatchRecalled(batchId);
    if (status.notFound) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    return res.status(200).json({ batchId, ...status });
  } catch (error) {
    console.error('getRecallStatus controller error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ── Reconciliation Controller ─────────────────────────────────────────────────

/**
 * GET /reconcile/:batchId
 * Returns reconciliation result for a single batch.
 * Admin-only endpoint.
 */
const reconcileSingle = async (req, res) => {
  try {
    const { batchId } = req.params;
    const result = await reconcileBatch(batchId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('reconcileSingle error:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * GET /reconcile
 * Returns reconciliation results for all batches (paginated).
 * Query params: limit, skip
 * Admin-only endpoint.
 */
const reconcileAll = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip  = parseInt(req.query.skip,  10) || 0;

    if (limit > 200) {
      return res.status(400).json({ error: 'limit cannot exceed 200' });
    }

    const result = await reconcileAllBatches({ limit, skip });
    return res.status(200).json(result);
  } catch (error) {
    console.error('reconcileAll error:', error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  recallBatch,
  getLineage,
  getRecallStatus,
  reconcileSingle,
  reconcileAll,
};
