const { ethers } = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    const HerbTrace = await ethers.getContractFactory("HerbTrace");
    const herbTrace = HerbTrace.attach(contractAddress);

    const batch = await herbTrace.getBatch("BATCH001");

    console.log("Batch ID:", batch.batchId);
    console.log("Current Owner:", batch.currentOwner);
    console.log("Status:", batch.status);
    console.log("Data Hash:", batch.dataHash);
    console.log("Last Updated:", batch.lastUpdated.toString());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});