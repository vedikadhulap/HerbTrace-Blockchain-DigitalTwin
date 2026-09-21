const express = require("express");
const router = express.Router();
const batchController = require("../controllers/batchController");
const upload = require("../middleware/upload");
//const protect = require("../middleware/authMiddleware");

// Public stat endpoints for home page
router.get("/count", batchController.getBatchCount);
router.get("/recent", batchController.getRecentActivity);

// Authenticated write endpoints
router.post("/", batchController.createBatch);
router.post("/lab-test", batchController.labTest);
router.post("/process", batchController.process);
router.post("/transfer", batchController.transfer);

// Public read endpoints
router.get("/verify/:batchId", batchController.verify);
router.get("/qrcode/:batchId", batchController.getQRCode);
router.get("/:id", batchController.getBatch);

// ─── Feature 1: Stage-Wise Merkle Anchoring ──────────────────────────────────
// Public — transparency endpoint. Anyone can fetch the Merkle proof for any
// completed stage of any batch to independently verify the data's authenticity.
// stageIndex: 0=Create, 1=Test, 2=Process, 3=Transfer
router.get("/:batchId/merkle-proof/:stageIndex", batchController.getMerkleProof);

// ─── Feature 2: Multi-Oracle Location Verification ───────────────────────────
// Public — shows all GPS oracle verification results for a batch.
// Returns per-stage consensus verdicts (verified / low_confidence / no_data).
router.get("/:batchId/location-verification", batchController.getLocationVerification);

// File upload — attached to an existing batch (batchId required in body)
router.post("/upload-image", upload.single("image"), batchController.uploadImage);

// Direct file upload — no batch required, returns IPFS URL
// Used for signup proof documents. Unprotected for now.
// TODO: add protect() for any-authenticated-role once middleware supports it
router.post("/upload-direct", upload.single("image"), batchController.uploadDirect);

module.exports = router;