const { ethers } = require("ethers");
const contractArtifact = require("../abi/HerbTrace.json");
// Hardhat artifacts wrap the ABI in an object — extract just the array
const contractABI = contractArtifact.abi || contractArtifact;
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);

const wallets = {
  farmer:      new ethers.Wallet(process.env.FARMER_PRIVATE_KEY,      provider),
  lab:         new ethers.Wallet(process.env.LAB_PRIVATE_KEY,         provider),
  processor:   new ethers.Wallet(process.env.PROCESSOR_PRIVATE_KEY,   provider),
  distributor: new ethers.Wallet(process.env.DISTRIBUTOR_PRIVATE_KEY, provider),
  // admin wallet holds DEFAULT_ADMIN_ROLE — used for Merkle anchoring & location verification
  admin:       new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY,       provider),
};

const getContract = (role) => {
  const wallet = wallets[role];
  if (!wallet) {
    throw new Error(`No wallet configured for role: ${role}`);
  }
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
};

module.exports = { getContract };