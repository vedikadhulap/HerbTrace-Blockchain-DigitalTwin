const hre = require("hardhat");

async function main() {
  const contractAddress = "0xA474CBcfa4f18fB52E945c2dAe478Fa06683BB78"; // your real contract address

  const labWallet = "0x20Fe2c5d074128b6c411BAF5CF704863C7764e50"; // your Lab address
  const processorWallet = "0x61E3f0448395f8Fd239a968a2a319c8526D99faF"; // your Processor address
  const distributorWallet = "0x2999b14C8B373Aea1bAaC0e2879fc497a479F761"; // your Distributor address

  const HerbTrace = await hre.ethers.getContractFactory("HerbTrace");
  const contract = HerbTrace.attach(contractAddress);

  let tx = await contract.addLab(labWallet);
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