const { ethers } = require("hardhat");

async function main() {
    const [account] = await ethers.getSigners();

    console.log("Wallet:", account.address);

    const balance = await ethers.provider.getBalance(account.address);

    console.log(
        "Sepolia ETH:",
        ethers.formatEther(balance)
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});