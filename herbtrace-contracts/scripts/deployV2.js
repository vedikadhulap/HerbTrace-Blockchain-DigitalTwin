const hre = require("hardhat");

async function main() {
  const HerbTrace = await hre.ethers.getContractFactory("HerbTrace");
  const contract = await HerbTrace.deploy();
  await contract.waitForDeployment();
  
  const newAddress = await contract.getAddress();
  console.log("HerbTrace V2 deployed to:", newAddress);
  console.log("Update CONTRACT_ADDRESS in .env to this new address");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});