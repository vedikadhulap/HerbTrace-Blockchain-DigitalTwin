const QRCode = require("qrcode");
   require("dotenv").config();

   const generateQRCode = async (batchId) => {
     // FRONTEND_URL points to the React app so QR scanning opens the styled page
     const base = process.env.FRONTEND_URL || process.env.BASE_URL || "http://localhost:5173";
     const verifyUrl = `${base}/verify/${batchId}`;
     const qrCodeImage = await QRCode.toDataURL(verifyUrl);
     return qrCodeImage;
   };

   module.exports = { generateQRCode };