require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(
    process.env.SEPOLIA_RPC_URL
);

async function testConnection() {
    const blockNumber = await provider.getBlockNumber();

    console.log("Connected to Ethereum Sepolia!");
    console.log("Latest block:", blockNumber);
}

testConnection();