const { ethers } = require("ethers");
const contractABI = require("../abi/HerbTrace.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC_URL);

const wallets = {
  farmer: new ethers.Wallet(process.env.FARMER_PRIVATE_KEY, provider),
  lab: new ethers.Wallet(process.env.LAB_PRIVATE_KEY, provider),
  processor: new ethers.Wallet(process.env.PROCESSOR_PRIVATE_KEY, provider),
  distributor: new ethers.Wallet(process.env.DISTRIBUTOR_PRIVATE_KEY, provider),
};

const getContract = (role) => {
  const wallet = wallets[role];
  if (!wallet) {
    throw new Error(`No wallet configured for role: ${role}`);
  }
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, wallet);
};

module.exports = { getContract };