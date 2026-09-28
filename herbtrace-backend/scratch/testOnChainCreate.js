const { getContract } = require("../services/blockchainService");
const { ethers } = require("ethers");
require("dotenv").config();

async function test() {
  try {
    const contract = getContract("farmer");
    console.log("Contract address:", await contract.getAddress());
    const batchId = `TEST-SEPOLIA-${Date.now()}`;
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test data"));
    
    console.log(`Submitting createBatch for ${batchId}...`);
    const tx = await contract.createBatch(batchId, dataHash);
    console.log("Tx submitted! Hash:", tx.hash);
    
    console.log("Waiting for receipt...");
    const receipt = await tx.wait();
    console.log("Mined in block:", receipt.blockNumber);
    console.log("Receipt hash:", receipt.hash);
  } catch (err) {
    console.error("Test error:", err);
  }
}

test();
