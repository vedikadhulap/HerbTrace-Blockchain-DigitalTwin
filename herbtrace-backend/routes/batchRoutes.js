const express = require("express");
const router = express.Router();
const batchController = require("../controllers/batchController");
const upload = require("../middleware/upload");
const protect = require("../middleware/authMiddleware");

router.post("/", protect("farmer"), batchController.createBatch);

router.get("/verify/:batchId", batchController.verify);

router.get("/:id", batchController.getBatch);

router.post("/lab-test", protect("lab"), batchController.labTest);

router.post("/process", protect("processor"), batchController.process);

router.post("/transfer", protect("distributor"), batchController.transfer);

router.post("/upload-image", upload.single("image"), batchController.uploadImage);

router.get("/qrcode/:batchId", batchController.getQRCode);

module.exports = router;