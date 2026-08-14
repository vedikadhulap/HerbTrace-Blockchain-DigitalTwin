const batchService = require("../services/batchService");

const createBatch = async (req, res) => {
  try {
    const { batchId, herbType, farmerWallet, latitude, longitude } = req.body;

    // basic validation — real validation (e.g. Joi/Zod) can come later
    if (!batchId || !herbType || !farmerWallet) {
      return res.status(400).json({ error: "batchId, herbType, and farmerWallet are required" });
    }

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "latitude and longitude are required" });
    }

    const batch = await batchService.createBatch(req.body);
    res.status(201).json(batch);
  } catch (error) {
    console.error("createBatch error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getBatch = async (req, res) => {
  try {
    const batch = await batchService.getBatchById(req.params.id);

    if (!batch) {
      return res.status(404).json({ error: "Batch not found" });
    }

    res.status(200).json(batch);
  } catch (error) {
    console.error("getBatch error:", error);
    res.status(500).json({ error: error.message });
  }
};

const labTest = async (req, res) => {
  try {
    const { batchId, testResults, labWallet } = req.body;

    if (!batchId || !testResults) {
      return res.status(400).json({ error: "batchId and testResults are required" });
    }

    const batch = await batchService.recordLabTest(req.body);
    res.status(200).json(batch);
  } catch (error) {
    console.error("labTest error:", error);

    if (error.message === "Batch not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};

const process = async (req, res) => {
  try {
    const { newBatchId, parentBatchIds } = req.body;

    if (!newBatchId || !parentBatchIds || !parentBatchIds.length) {
      return res.status(400).json({ error: "newBatchId and parentBatchIds are required" });
    }

    const batch = await batchService.processBatch(req.body);
    res.status(201).json(batch);
  } catch (error) {
    console.error("process error:", error);

    if (error.message === "One or more parent batches not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};

const transfer = async (req, res) => {
  try {
    const { batchId, newOwner, senderRole } = req.body;

    if (!batchId || !newOwner || !senderRole) {
      return res.status(400).json({ error: "batchId, newOwner, and senderRole are required" });
    }

    const batch = await batchService.transferBatch(req.body);
    res.status(200).json(batch);
  } catch (error) {
    console.error("transfer error:", error);

    if (error.message === "Batch not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};

const verify = async (req, res) => {
  try {
    const result = await batchService.verifyBatch(req.params.batchId);
    res.status(200).json(result);
  } catch (error) {
    console.error("verify error:", error);

    if (error.message === "Batch not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    const { batchId } = req.body;

    if (!batchId || !req.file) {
      return res.status(400).json({ error: "batchId and an image file are required" });
    }

    const batch = await batchService.addImageToBatch(batchId, req.file);
    res.status(200).json(batch);
  } catch (error) {
    console.error("uploadImage error:", error);

    if (error.message === "Batch not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};

const getQRCode = async (req, res) => {
  try {
    const qrCode = await batchService.getBatchQRCode(req.params.batchId);
    res.status(200).json({ qrCode });
  } catch (error) {
    console.error("getQRCode error:", error);

    if (error.message === "Batch not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
};


module.exports = { createBatch, getBatch, labTest, process, transfer, verify, uploadImage, getQRCode };