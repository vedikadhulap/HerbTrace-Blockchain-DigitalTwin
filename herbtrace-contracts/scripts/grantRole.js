const hre = require("hardhat");

async function main() {
  const contractAddress = "0x5Ce1bdace5d3276f9b8f290E2AFdA74819a1A6A2"; // V3 deployed contract

  const farmerWallet      = "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8";
  const labWallet         = "0x20Fe2c5d074128b6c411BAF5CF704863C7764e50";
  const processorWallet   = "0x61E3f0448395f8Fd239a968a2a319c8526D99faF";
  const distributorWallet = "0x2999b14C8B373Aea1bAaC0e2879fc497a479F761";

  const HerbTrace = await hre.ethers.getContractFactory("HerbTrace");
  const contract  = HerbTrace.attach(contractAddress);

  let tx;

  tx = await contract.addFarmer(farmerWallet);
  await tx.wait();
  console.log(`Granted FARMER_ROLE to ${farmerWallet}`);

  tx = await contract.addLab(labWallet);
  await tx.wait();
  console.log(`Granted LAB_ROLE to ${labWallet}`);

  tx = await contract.addProcessor(processorWallet);
  await tx.wait();
  console.log(`Granted PROCESSOR_ROLE to ${processorWallet}`);

  tx = await contract.addDistributor(distributorWallet);
  await tx.wait();
  console.log(`Granted DISTRIBUTOR_ROLE to ${distributorWallet}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});