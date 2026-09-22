const hre = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    const labWallet = "0x20Fe2c5d074128b6c411BAF5CF704863C7764e50";

    const HerbTrace = await hre.ethers.getContractFactory("HerbTrace");
    const contract = HerbTrace.attach(contractAddress);

    const LAB_ROLE = await contract.LAB_ROLE();

    const hasRole = await contract.hasRole(
        LAB_ROLE,
        labWallet
    );

    console.log("Lab Wallet:", labWallet);
    console.log("Has LAB_ROLE:", hasRole);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});