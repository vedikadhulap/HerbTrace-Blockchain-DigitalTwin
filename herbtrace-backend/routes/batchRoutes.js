const express = require("express");
const router = express.Router();
const batchController = require("../controllers/batchController");
const { recallBatch, getLineage, getRecallStatus, reconcileSingle, reconcileAll } = require("../controllers/recallController");
const upload = require("../middleware/upload");
const protect = require("../middleware/authMiddleware");

// Public stat endpoints for home page
router.get("/count", batchController.getBatchCount);
router.get("/recent", batchController.getRecentActivity);

// ─── Recall — admin-only write endpoint ─────────────────────────────────────
// POST /batch/recall — initiates lineage-based recall
router.post("/recall", protect("admin"), recallBatch);

// ─── Reconciliation — admin-only read endpoints ──────────────────────────────
// GET /batch/reconcile — reconcile all batches (paginated)
router.get("/reconcile", protect("admin"), reconcileAll);
// GET /batch/reconcile/:batchId — reconcile a single batch
router.get("/reconcile/:batchId", protect("admin"), reconcileSingle);

// Authenticated write endpoints
router.post("/", batchController.createBatch);
router.post("/lab-test", batchController.labTest);
router.post("/process", batchController.process);
router.post("/transfer", batchController.transfer);

// Public read endpoints
router.get("/verify/:batchId", batchController.verify);
router.get("/qrcode/:batchId", batchController.getQRCode);

// ─── Failure Resilience — lineage & recall status ─────────────────────────────
// GET /batch/:batchId/lineage — return full lineage chain for a batch
router.get("/:batchId/lineage", getLineage);
// GET /batch/:batchId/recall-status — check if a batch is recalled/blocked
router.get("/:batchId/recall-status", getRecallStatus);

// ─── Feature 1: Stage-Wise Merkle Anchoring ──────────────────────────────────
// Public — transparency endpoint. Anyone can fetch the Merkle proof for any
// completed stage of any batch to independently verify the data's authenticity.
// stageIndex: 0=Create, 1=Test, 2=Process, 3=Transfer
router.get("/:batchId/merkle-proof/:stageIndex", batchController.getMerkleProof);

// ─── Feature 2: Multi-Oracle Location Verification ───────────────────────────
// Public — shows all GPS oracle verification results for a batch.
// Returns per-stage consensus verdicts (verified / low_confidence / no_data).
router.get("/:batchId/location-verification", batchController.getLocationVerification);

// ─── Addition 2: Spatiotemporal Fraud Detection ─────────────────────────────
// Public — security endpoint showing spatiotemporal movement fraud analysis for a batch.
router.get("/:batchId/spatiotemporal-fraud", batchController.getSpatiotemporalFraudCheck);

// Generic single-batch get (must come AFTER specific sub-paths)
router.get("/:id", batchController.getBatch);

// File upload — attached to an existing batch (batchId required in body)
router.post("/upload-image", upload.single("image"), batchController.uploadImage);

// Direct file upload — no batch required, returns IPFS URL
// Used for signup proof documents. Unprotected for now.
router.post("/upload-direct", upload.single("image"), batchController.uploadDirect);

module.exports = router;