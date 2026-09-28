const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, "../../herbtrace-backend/.env") });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x5Ce1bdace5d3276f9b8f290E2AFdA74819a1A6A2";
  const rpcUrl          = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/alch_JBqktWf_4Cct__zVrZhbK";

  console.log("==========================================================================");
  console.log("          SEPOLIA ON-CHAIN GAS MEASUREMENT BENCHMARK (3 RUNS)             ");
  console.log("==========================================================================");
  console.log(`Target Contract Address: ${contractAddress}`);
  console.log(`Sepolia RPC URL:         ${rpcUrl}\n`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Load private keys for the 4 role wallets
  const farmerPk      = process.env.PRIVATE_KEY || process.env.FARMER_PRIVATE_KEY;
  const labPk         = process.env.LAB_PRIVATE_KEY;
  const processorPk   = process.env.PROCESSOR_PRIVATE_KEY || "853e66211c49af5c9928d79b883b42a4c12f56a6723a94fd1f5f1f1e9c00df0d";
  const distributorPk = process.env.DISTRIBUTOR_PRIVATE_KEY || "feb81bc7ab650172d9f45e81a034e3c6102b11aad684a9b636da4f1205184088";

  const farmer      = new ethers.Wallet(farmerPk, provider);
  const lab         = new ethers.Wallet(labPk, provider);
  const processor   = new ethers.Wallet(processorPk, provider);
  const distributor = new ethers.Wallet(distributorPk, provider);

  console.log("Loaded Role Signers:");
  console.log(`  Farmer:      ${farmer.address}`);
  console.log(`  Lab:         ${lab.address}`);
  console.log(`  Processor:   ${processor.address}`);
  console.log(`  Distributor: ${distributor.address}\n`);

  // Deployed Sepolia contract ABI interface
  const contractAbi = [
    "function createBatch(string batchId, bytes32 dataHash)",
    "function recordTest(string batchId, bytes32 dataHash)",
    "function processBatch(string newBatchId, string[] parentBatchIds, bytes32 dataHash)",
    "function transferCustody(string batchId, address newOwner, bytes32 dataHash)",
    "function anchorMerkleRoot(string batchId, uint256 stageIndex, bytes32 merkleRoot)"
  ];

  const cFarmer      = new ethers.Contract(contractAddress, contractAbi, farmer);
  const cLab         = new ethers.Contract(contractAddress, contractAbi, lab);
  const cProcessor   = new ethers.Contract(contractAddress, contractAbi, processor);
  const cDistributor = new ethers.Contract(contractAddress, contractAbi, distributor);

  const ITERATIONS = 3;
  const functions = [
    "createBatch",
    "recordTest",
    "processBatch",
    "transferCustody",
    "anchorMerkleRoot"
  ];

  // Store results: { [funcName]: [ { run, txHash, gasUsed, effectiveGasPrice, costWei }, ... ] }
  const results = {
    createBatch: [],
    recordTest: [],
    processBatch: [],
    transferCustody: [],
    anchorMerkleRoot: []
  };

  const timestamp = Date.now();

  for (let run = 1; run <= ITERATIONS; run++) {
    console.log(`--------------------------------------------------------------------------`);
    console.log(`>>> STARTING RUN ${run} OF ${ITERATIONS}`);
    console.log(`--------------------------------------------------------------------------`);

    const rawBatchId  = `SEP-BENCH-${timestamp}-R${run}-RAW`;
    const procBatchId = `SEP-BENCH-${timestamp}-R${run}-PROC`;
    const dataHash    = ethers.keccak256(ethers.toUtf8Bytes(`bench-data-${timestamp}-run-${run}`));
    const merkleRoot  = ethers.keccak256(ethers.toUtf8Bytes(`merkle-root-${timestamp}-run-${run}`));

    // 1. createBatch (Farmer)
    console.log(`[Run ${run}] Executing createBatch()...`);
    let tx = await cFarmer.createBatch(rawBatchId, dataHash);
    console.log(`  txHash: ${tx.hash}`);
    let receipt = await tx.wait();
    let gasUsed = receipt.gasUsed;
    let effectiveGasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
    let costWei = gasUsed * effectiveGasPrice;
    results.createBatch.push({ run, txHash: receipt.hash, gasUsed, effectiveGasPrice, costWei });
    console.log(`  gasUsed: ${gasUsed.toString()} | gasPrice: ${ethers.formatUnits(effectiveGasPrice, "gwei")} gwei | cost: ${costWei.toString()} wei (${ethers.formatEther(costWei)} ETH)`);
    await sleep(12000);

    // 2. recordTest (Lab)
    console.log(`[Run ${run}] Executing recordTest()...`);
    tx = await cLab.recordTest(rawBatchId, dataHash);
    console.log(`  txHash: ${tx.hash}`);
    receipt = await tx.wait();
    gasUsed = receipt.gasUsed;
    effectiveGasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
    costWei = gasUsed * effectiveGasPrice;
    results.recordTest.push({ run, txHash: receipt.hash, gasUsed, effectiveGasPrice, costWei });
    console.log(`  gasUsed: ${gasUsed.toString()} | gasPrice: ${ethers.formatUnits(effectiveGasPrice, "gwei")} gwei | cost: ${costWei.toString()} wei (${ethers.formatEther(costWei)} ETH)`);
    await sleep(12000);

    // 3. processBatch (Processor)
    console.log(`[Run ${run}] Executing processBatch()...`);
    tx = await cProcessor.processBatch(procBatchId, [rawBatchId], dataHash);
    console.log(`  txHash: ${tx.hash}`);
    receipt = await tx.wait();
    gasUsed = receipt.gasUsed;
    effectiveGasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
    costWei = gasUsed * effectiveGasPrice;
    results.processBatch.push({ run, txHash: receipt.hash, gasUsed, effectiveGasPrice, costWei });
    console.log(`  gasUsed: ${gasUsed.toString()} | gasPrice: ${ethers.formatUnits(effectiveGasPrice, "gwei")} gwei | cost: ${costWei.toString()} wei (${ethers.formatEther(costWei)} ETH)`);
    await sleep(12000);

    // 4. transferCustody (Distributor)
    console.log(`[Run ${run}] Executing transferCustody()...`);
    tx = await cDistributor.transferCustody(procBatchId, distributor.address, dataHash);
    console.log(`  txHash: ${tx.hash}`);
    receipt = await tx.wait();
    gasUsed = receipt.gasUsed;
    effectiveGasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
    costWei = gasUsed * effectiveGasPrice;
    results.transferCustody.push({ run, txHash: receipt.hash, gasUsed, effectiveGasPrice, costWei });
    console.log(`  gasUsed: ${gasUsed.toString()} | gasPrice: ${ethers.formatUnits(effectiveGasPrice, "gwei")} gwei | cost: ${costWei.toString()} wei (${ethers.formatEther(costWei)} ETH)`);
    await sleep(12000);

    // 5. anchorMerkleRoot (Farmer / Role Signer)
    console.log(`[Run ${run}] Executing anchorMerkleRoot()...`);
    tx = await cFarmer.anchorMerkleRoot(procBatchId, 3, merkleRoot);
    console.log(`  txHash: ${tx.hash}`);
    receipt = await tx.wait();
    gasUsed = receipt.gasUsed;
    effectiveGasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
    costWei = gasUsed * effectiveGasPrice;
    results.anchorMerkleRoot.push({ run, txHash: receipt.hash, gasUsed, effectiveGasPrice, costWei });
    console.log(`  gasUsed: ${gasUsed.toString()} | gasPrice: ${ethers.formatUnits(effectiveGasPrice, "gwei")} gwei | cost: ${costWei.toString()} wei (${ethers.formatEther(costWei)} ETH)\n`);
    if (run < ITERATIONS) await sleep(12000);
  }

  // --------------------------------------------------------------------------
  // PRINT SUMMARY TABLE & MEAN CALCULATIONS
  // --------------------------------------------------------------------------
  console.log("==========================================================================");
  console.log("                   SEPOLIA BENCHMARK RESULTS SUMMARY                      ");
  console.log("==========================================================================");

  console.log("\n### Detailed Transaction Output (Per Run)\n");
  console.log("| Run | Function Name | Transaction Hash | Gas Used | Effective Gas Price (gwei) | Cost (Wei) | Cost (ETH) |");
  console.log("|---|---|---|---|---|---|---|");

  for (const func of functions) {
    for (const item of results[func]) {
      const gweiPrice = ethers.formatUnits(item.effectiveGasPrice, "gwei");
      const ethCost   = ethers.formatEther(item.costWei);
      console.log(`| Run ${item.run} | \`${func}\` | \`${item.txHash}\` | ${item.gasUsed.toString()} | ${gweiPrice} | ${item.costWei.toString()} | ${ethCost} |`);
    }
  }

  console.log("\n### Mean Gas Consumption Per Function\n");
  console.log("| Function Name | Run 1 Gas | Run 2 Gas | Run 3 Gas | Mean Gas Used |");
  console.log("|---|---|---|---|---|");

  const means = {};

  for (const func of functions) {
    const r1 = Number(results[func][0].gasUsed);
    const r2 = Number(results[func][1].gasUsed);
    const r3 = Number(results[func][2].gasUsed);
    const mean = (r1 + r2 + r3) / 3;
    means[func] = mean;
    console.log(`| \`${func}\` | ${r1} | ${r2} | ${r3} | ${mean.toFixed(2)} |`);
  }

  // Calculate overall totals
  const totalR1 = functions.reduce((acc, f) => acc + Number(results[f][0].gasUsed), 0);
  const totalR2 = functions.reduce((acc, f) => acc + Number(results[f][1].gasUsed), 0);
  const totalR3 = functions.reduce((acc, f) => acc + Number(results[f][2].gasUsed), 0);
  const totalMean = functions.reduce((acc, f) => acc + means[f], 0);

  console.log(`| **TOTAL LIFECYCLE** | **${totalR1}** | **${totalR2}** | **${totalR3}** | **${totalMean.toFixed(2)}** |`);
  console.log("\n==========================================================================\n");
}

main().catch((error) => {
  console.error("Benchmark failed with error:", error);
  process.exitCode = 1;
});
