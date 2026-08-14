const hre = require("hardhat");

async function main() {
    const labWallet = new hre.ethers.Wallet(
        process.env.LAB_PRIVATE_KEY,
        hre.ethers.provider
    );

    const balance = await hre.ethers.provider.getBalance(
        labWallet.address
    );

    console.log("Lab wallet:", labWallet.address);
    console.log(
        "Sepolia ETH:",
        hre.ethers.formatEther(balance)
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});