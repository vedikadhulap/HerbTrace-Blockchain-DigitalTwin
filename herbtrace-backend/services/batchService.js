const { ethers } = require("ethers");
const Batch = require("../models/Batch");
const { getContract } = require("./blockchainService");
const contract = getContract("farmer");

const createBatch = async (data) => {
  const { batchId, herbType, farmerWallet, farmLocation, harvestDate, quantityKg } = data;

  // 1. Compute a hash of the meaningful data — this is what proves integrity later
  const dataString = JSON.stringify({ batchId, herbType, farmerWallet, farmLocation, harvestDate, quantityKg });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  // 2. Write to the blockchain first — if this fails, we don't want a Mongo record
  //    claiming to be "on-chain" when it isn't
  const tx = await contract.createBatch(batchId, dataHash);
  const receipt = await tx.wait(); // wait for the transaction to actually be mined

  // 3. Only after the chain confirms, save the full record to MongoDB
  const batch = await Batch.create({
    batchId,
    herbType,
    farmerWallet,
    farmLocation,
    harvestDate,
    quantityKg,
    dataHash,
    txHash: receipt.hash,
    status: "CREATED",
  });

  return batch;
};



const getBatchById = async (batchId) => {
  const batch = await Batch.findOne({ batchId });
  return batch;
};

const recordLabTest = async (data) => {
  const { batchId, testResults, labWallet } = data;

  // 1. Confirm the batch actually exists before trying to test it
  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) {
    throw new Error("Batch not found");
  }

  // 2. Compute a new hash reflecting the test results being added
  const dataString = JSON.stringify({ batchId, testResults, labWallet });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  // 3. Sign with the LAB wallet this time — this is the whole point of the multi-wallet setup
  const labContract = getContract("lab");
  const tx = await labContract.recordTest(batchId, dataHash);
  const receipt = await tx.wait();

  // 4. Update the existing Mongo document, don't create a new one
  existingBatch.status = "TESTED";
  existingBatch.dataHash = dataHash;
  existingBatch.txHash = receipt.hash;
  await existingBatch.save();

  return existingBatch;
};

const processBatch = async (data) => {
  const { newBatchId, parentBatchIds, processorNotes } = data;

  // Make sure all the parent batches actually exist first
  const parents = await Batch.find({ batchId: { $in: parentBatchIds } });
  if (parents.length !== parentBatchIds.length) {
    throw new Error("One or more parent batches not found");
  }

  // Make a hash for this new processed batch
  const dataString = JSON.stringify({ newBatchId, parentBatchIds, processorNotes });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  // Sign with the Processor wallet
  const processorContract = getContract("processor");
  const tx = await processorContract.processBatch(newBatchId, parentBatchIds, dataHash);
  const receipt = await tx.wait();

  // Save the new batch in Mongo
  const newBatch = await Batch.create({
    batchId: newBatchId,
    herbType: parents[0].herbType, // simple assumption: same herb type as parents
    farmerWallet: parents[0].farmerWallet,
    dataHash,
    txHash: receipt.hash,
    status: "PROCESSED",
    parentBatchIds,
  });

  return newBatch;
};

const transferBatch = async (data) => {
  const { batchId, newOwner, senderRole } = data;

  // Check the batch actually exists
  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) {
    throw new Error("Batch not found");
  }

  // Make a fingerprint of this transfer
  const dataString = JSON.stringify({ batchId, newOwner });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  // Sign with whichever wallet is sending the batch
  const senderContract = getContract(senderRole);
  const tx = await senderContract.transferCustody(batchId, newOwner, dataHash);
  const receipt = await tx.wait();

  // Update the batch in Mongo
  existingBatch.status = "TRANSFERRED";
  existingBatch.dataHash = dataHash;
  existingBatch.txHash = receipt.hash;
  await existingBatch.save();

  return existingBatch;
};

const verifyBatch = async (batchId) => {
  const batch = await Batch.findOne({ batchId });
  if (!batch) {
    throw new Error("Batch not found");
  }

  // If this batch was made from other batches, fetch those too
  let parents = [];
  if (batch.parentBatchIds && batch.parentBatchIds.length > 0) {
    parents = await Batch.find({ batchId: { $in: batch.parentBatchIds } });
  }

  return { batch, parents };
};


const { uploadToPinata } = require("./pinataService");

const addImageToBatch = async (batchId, file) => {
  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) {
    throw new Error("Batch not found");
  }

  const imageUrl = await uploadToPinata(file);
  existingBatch.images.push(imageUrl);
  await existingBatch.save();

  return existingBatch;
};

const { generateQRCode } = require("./qrService");

const getBatchQRCode = async (batchId) => {
  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) {
    throw new Error("Batch not found");
  }

  const qrCode = await generateQRCode(batchId);
  return qrCode;
};

module.exports = { createBatch, getBatchById, recordLabTest, processBatch, transferBatch, verifyBatch, addImageToBatch, getBatchQRCode };