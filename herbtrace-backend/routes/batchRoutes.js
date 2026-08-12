const express = require("express");
const router = express.Router();
const batchController = require("../controllers/batchController");
const upload = require("../middleware/upload");

router.post("/", batchController.createBatch);

router.get("/verify/:batchId", batchController.verify);

router.get("/:id", batchController.getBatch);

router.post("/lab-test", batchController.labTest);

router.post("/process", batchController.process);

router.post("/transfer", batchController.transfer);

router.post("/upload-image", upload.single("image"), batchController.uploadImage);

router.get("/qrcode/:batchId", batchController.getQRCode);


module.exports = router;