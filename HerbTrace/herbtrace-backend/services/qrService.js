const QRCode = require("qrcode");
require("dotenv").config();

const generateQRCode = async (batchId) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:5173";
  const verifyUrl = `${baseUrl}/verify/${batchId}`;
  const qrCodeImage = await QRCode.toDataURL(verifyUrl);
  return qrCodeImage;
};

module.exports = { generateQRCode };