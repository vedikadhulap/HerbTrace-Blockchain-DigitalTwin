const multer = require("multer");

// Store the file temporarily in memory, not on disk
const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = upload;