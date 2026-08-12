const QRCode = require("qrcode");
   require("dotenv").config();

   const generateQRCode = async (batchId) => {
     const verifyUrl = `${process.env.BASE_URL}/batch/verify/${batchId}`;
     const qrCodeImage = await QRCode.toDataURL(verifyUrl);
     return qrCodeImage;
   };

   module.exports = { generateQRCode };