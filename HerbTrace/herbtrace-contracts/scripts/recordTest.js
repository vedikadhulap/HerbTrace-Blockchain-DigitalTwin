const hre = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    // Lab wallet private key
    const labPrivateKey = process.env.LAB_PRIVATE_KEY;

    if (!labPrivateKey) {
        throw new Error("LAB_PRIVATE_KEY is missing from .env");
    }

    const provider = hre.ethers.provider;

    // Create the Lab wallet and connect it to Sepolia
    const labWallet = new hre.ethers.Wallet(
        labPrivateKey,
        provider
    );

    console.log("Lab wallet:", labWallet.address);

    // Connect to deployed HerbTrace contract
    const HerbTrace = await hre.ethers.getContractFactory("HerbTrace");
    const contract = HerbTrace.attach(contractAddress).connect(labWallet);

    // Example lab-test data
    const testData = "BATCH001-LAB-TEST-PASSED";

    // Convert test data into bytes32
    const dataHash = hre.ethers.keccak256(
        hre.ethers.toUtf8Bytes(testData)
    );

    console.log("Batch ID:", "BATCH001");
    console.log("Test data:", testData);
    console.log("Data hash:", dataHash);

    console.log("\nSending transaction...");

    const tx = await contract.recordTest(
        "BATCH001",
        dataHash
    );

    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for transaction to be mined...");

    const receipt = await tx.wait();

    console.log("Transaction mined!");
    console.log("Block number:", receipt.blockNumber);
    console.log("Transaction hash:", receipt.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});