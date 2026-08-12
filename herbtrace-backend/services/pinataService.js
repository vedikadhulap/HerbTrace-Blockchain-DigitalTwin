const { PinataSDK } = require("pinata-web3");
require("dotenv").config();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
});

const uploadToPinata = async (file) => {
  const fileForUpload = new File([file.buffer], file.originalname, {
    type: file.mimetype,
  });

  const result = await pinata.upload.file(fileForUpload);
  const url = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;

  return url;
};

module.exports = { uploadToPinata };