const { PinataSDK } = require("pinata-web3");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

let pinata;
if (process.env.PINATA_JWT) {
  try {
    pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY || "gateway.pinata.cloud",
    });
  } catch (e) {
    console.warn("[Pinata] SDK init warning:", e.message);
  }
}

const uploadToPinata = async (file) => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer provided for upload.");
  }

  // Ensure local uploads directory exists
  const uploadsDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Save file locally so it is ALWAYS accessible
  const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex").slice(0, 24);
  const ext = path.extname(file.originalname || "document.png") || ".png";
  const savedFileName = `${Date.now()}-${fileHash}${ext}`;
  const localFilePath = path.join(uploadsDir, savedFileName);
  fs.writeFileSync(localFilePath, file.buffer);

  const PORT = process.env.PORT || 5000;
  const localUrl = `http://localhost:${PORT}/uploads/${savedFileName}`;

  // Try Pinata IPFS upload
  if (pinata) {
    try {
      const fileForUpload = new File([file.buffer], file.originalname || "document.png", {
        type: file.mimetype || "image/png",
      });

      const result = await pinata.upload.file(fileForUpload);
      if (result && result.IpfsHash) {
        // Return public Cloudflare IPFS Gateway link that opens reliably without auth issues
        return `https://cloudflare-ipfs.com/ipfs/${result.IpfsHash}`;
      }
    } catch (err) {
      console.warn(`[Pinata] IPFS upload warning: ${err.message}. Using local upload URL: ${localUrl}`);
    }
  }

  return localUrl;
};

module.exports = { uploadToPinata };