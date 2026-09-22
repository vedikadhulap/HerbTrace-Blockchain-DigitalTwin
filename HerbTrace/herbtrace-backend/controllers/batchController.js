const batchService = require("../services/batchService");

const createBatch = async (req, res) => {
  try {
    const { batchId, herbType, farmerWallet, latitude, longitude } = req.body;

    if (!batchId || !herbType || !farmerWallet) {
      return res.status(400).json({ error: "batchId, herbType, and farmerWallet are required" });
    }
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const batch = await batchService.createBatch({ ...req.body, userId: req.user?.userId });
    res.status(201).json(batch);
  } catch (error) {
    console.error("createBatch error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getBatch = async (req, res) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    res.status(200).json(batch);
  } catch (error) {
    console.error("getBatch error:", error);
    res.status(500).json({ error: error.message });
  }
};

const labTest = async (req, res) => {
  try {
    const { batchId, testResults } = req.body;
    if (!batchId || !testResults) {
      return res.status(400).json({ error: "batchId and testResults are required" });
    }
    // batchService now returns { batch, agreedLocation } so we can surface the
    // resolved place name (e.g. "Mumbai, Maharashtra") in the API response.
    const { batch, agreedLocation } = await batchService.recordLabTest({ ...req.body, userId: req.user?.userId });
    res.status(200).json({ ...batch.toObject(), agreedLocation });
  } catch (error) {
    console.error("labTest error:", error);
    if (error.message === "Batch not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const process = async (req, res) => {
  try {
    const { newBatchId, parentBatchIds } = req.body;
    if (!newBatchId || !parentBatchIds || !parentBatchIds.length) {
      return res.status(400).json({ error: "newBatchId and parentBatchIds are required" });
    }
    const { batch, agreedLocation } = await batchService.processBatch({ ...req.body, userId: req.user?.userId });
    res.status(201).json({ ...batch.toObject(), agreedLocation });
  } catch (error) {
    console.error("process error:", error);
    if (error.message === "One or more parent batches not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const transfer = async (req, res) => {
  try {
    const { batchId, newOwner, senderRole } = req.body;
    if (!batchId || !newOwner || !senderRole) {
      return res.status(400).json({ error: "batchId, newOwner, and senderRole are required" });
    }
    const { batch, agreedLocation } = await batchService.transferBatch({ ...req.body, userId: req.user?.userId });
    res.status(200).json({ ...batch.toObject(), agreedLocation });
  } catch (error) {
    console.error("transfer error:", error);
    if (error.message === "Batch not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const verify = async (req, res) => {
  try {
    const result = await batchService.verifyBatch(req.params.batchId);
    res.status(200).json(result);
  } catch (error) {
    console.error("verify error:", error);
    if (error.message === "Batch not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    const { batchId } = req.body;
    if (!batchId || !req.file) {
      return res.status(400).json({ error: "batchId and a file are required" });
    }
    const batch = await batchService.addImageToBatch(batchId, req.file);
    res.status(200).json(batch);
  } catch (error) {
    console.error("uploadImage error:", error);
    if (error.message === "Batch not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const getQRCode = async (req, res) => {
  try {
    const qrCode = await batchService.getBatchQRCode(req.params.batchId);
    res.status(200).json({ qrCode });
  } catch (error) {
    console.error("getQRCode error:", error);
    if (error.message === "Batch not found") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
};

// Direct file upload — no batch required. Returns an IPFS URL.
// Used for signup proof documents and any pre-batch upload.
// TODO: add protect() for any-authenticated-role once middleware supports it
const uploadDirect = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "A file is required." });
    const { uploadToPinata } = require("../services/pinataService");
    const ipfsUrl = await uploadToPinata(req.file);
    res.status(200).json({ ipfsUrl });
  } catch (error) {
    console.error("uploadDirect error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /batch/count — public, total batch count for home page live stat
const getBatchCount = async (req, res) => {
  try {
    const count = await batchService.getBatchCount();
    res.status(200).json({ count });
  } catch (error) {
    console.error("getBatchCount error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /batch/recent — public, last 5 batch events for home page activity feed
const getRecentActivity = async (req, res) => {
  try {
    const batches = await batchService.getRecentActivity();
    res.status(200).json(batches);
  } catch (error) {
    console.error("getRecentActivity error:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /batch/:batchId/merkle-proof/:stageIndex
// Returns the Merkle proof for a specific stage of a batch.
// Anyone can use this to verify stage data authenticity without trusting the server.
const getMerkleProof = async (req, res) => {
  try {
    const { batchId, stageIndex } = req.params;
    const result = await batchService.getMerkleProof(batchId, stageIndex);
    res.status(200).json(result);
  } catch (error) {
    console.error("getMerkleProof error:", error);
    if (error.message.includes("not found") || error.message.includes("not been completed")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("must be 0")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// GET /batch/:batchId/location-verification
// Returns all multi-oracle consensus location verifications for a batch.
// Shows which stages had GPS verified by 2+ independent oracles.
const getLocationVerification = async (req, res) => {
  try {
    const { batchId } = req.params;
    const records = await batchService.getLocationVerifications(batchId);
    res.status(200).json({
      batchId,
      totalStages:      records.length,
      verifiedCount:    records.filter((r) => r.verified).length,
      lowConfidence:    records.filter((r) => r.consensus === "low_confidence").length,
      stages:           records,
    });
  } catch (error) {
    console.error("getLocationVerification error:", error);
    if (error.message.includes("No location")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createBatch, getBatch, labTest, process, transfer, verify,
  uploadImage, uploadDirect, getQRCode, getBatchCount, getRecentActivity,
  // Feature 1: Merkle Anchoring
  getMerkleProof,
  // Feature 2: Multi-Oracle Location
  getLocationVerification,
};