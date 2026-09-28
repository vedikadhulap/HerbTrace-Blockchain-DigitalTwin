const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

describe("HerbTrace Gas Consumption Benchmark", function () {
  let herbTrace;
  let admin, farmer, lab, processor, distributor;

  const ITERATIONS = 10;
  const gasData = {
    createBatch: [],
    recordTest: [],
    processBatch: [],
    transferCustody: [],
    anchorMerkleRoot: [],
    recordLocationVerification: []
  };

  // Helper to calculate stats
  function calculateStats(measurements) {
    if (measurements.length === 0) return null;
    const sorted = [...measurements].sort((a, b) => Number(a) - Number(b));
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = sorted.reduce((acc, val) => acc + Number(val), 0);
    const mean = sum / sorted.length;
    const median = sorted.length % 2 === 0 
      ? (Number(sorted[sorted.length / 2 - 1]) + Number(sorted[sorted.length / 2])) / 2
      : Number(sorted[Math.floor(sorted.length / 2)]);
    
    // Variance and stddev
    const variance = sorted.reduce((acc, val) => acc + Math.pow(Number(val) - mean, 2), 0) / sorted.length;
    const stdDev = Math.sqrt(variance);

    return { min: Number(min), max: Number(max), mean, median, stdDev, measurements: measurements.map(Number) };
  }

  before(async function () {
    [admin, farmer, lab, processor, distributor] = await ethers.getSigners();
    
    const HerbTrace = await ethers.getContractFactory("HerbTrace");
    herbTrace = await HerbTrace.deploy();
    // Ethers v6: wait for deployment
    await herbTrace.waitForDeployment();

    await herbTrace.connect(admin).addFarmer(farmer.address);
    await herbTrace.connect(admin).addLab(lab.address);
    await herbTrace.connect(admin).addProcessor(processor.address);
    await herbTrace.connect(admin).addDistributor(distributor.address);
  });

  it("should benchmark lifecycle operations across multiple iterations", async function () {
    for (let i = 0; i < ITERATIONS; i++) {
      const batchId = `BATCH-FARM-${i}`;
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes(`data-${i}`));
      
      // 1. createBatch
      let tx = await herbTrace.connect(farmer).createBatch(batchId, dataHash);
      let receipt = await tx.wait();
      gasData.createBatch.push(receipt.gasUsed);

      // 2. recordTest — v3 signature: (batchId, dataHash, outcome, reason)
      // LabOutcome.Pass = 0
      tx = await herbTrace.connect(lab).recordTest(batchId, dataHash, 0, "");
      receipt = await tx.wait();
      gasData.recordTest.push(receipt.gasUsed);

      // 3. processBatch (creates a new batch ID; parent must be Tested)
      const processBatchId = `BATCH-PROC-${i}`;
      tx = await herbTrace.connect(processor).processBatch(processBatchId, [batchId], dataHash);
      receipt = await tx.wait();
      gasData.processBatch.push(receipt.gasUsed);

      // 4. transferCustody
      tx = await herbTrace.connect(distributor).transferCustody(processBatchId, distributor.address, dataHash);
      receipt = await tx.wait();
      gasData.transferCustody.push(receipt.gasUsed);

      // 5. anchorMerkleRoot — v3 signature: (batchId, stageIndex, merkleRoot)
      const merkleRoot = ethers.keccak256(ethers.toUtf8Bytes(`merkle-${i}`));
      tx = await herbTrace.connect(admin).anchorMerkleRoot(processBatchId, 3, merkleRoot);
      receipt = await tx.wait();
      gasData.anchorMerkleRoot.push(receipt.gasUsed);

      // 6. recordLocationVerification
      tx = await herbTrace.connect(admin).recordLocationVerification(processBatchId, 3, true, "12.34,56.78");
      receipt = await tx.wait();
      gasData.recordLocationVerification.push(receipt.gasUsed);
    }
  });

  after(async function () {
    // Generate Reports
    const stats = {
      createBatch: calculateStats(gasData.createBatch),
      recordTest: calculateStats(gasData.recordTest),
      processBatch: calculateStats(gasData.processBatch),
      transferCustody: calculateStats(gasData.transferCustody),
      anchorMerkleRoot: calculateStats(gasData.anchorMerkleRoot),
      recordLocationVerification: calculateStats(gasData.recordLocationVerification)
    };

    // Calculate baseline vs current
    const baseMeanCreate = stats.createBatch.mean;
    const baseMeanTest = stats.recordTest.mean;
    const baseMeanProcess = stats.processBatch.mean;
    const baseMeanTransfer = stats.transferCustody.mean;
    const baseMeanAnchor = stats.anchorMerkleRoot.mean;

    const currentTotalGas = baseMeanCreate + baseMeanTest + baseMeanProcess + baseMeanTransfer + (1 * baseMeanAnchor);
    const baselineTotalGas = baseMeanCreate + baseMeanTest + baseMeanProcess + baseMeanTransfer + (4 * baseMeanAnchor);
    const absoluteGasDifference = baselineTotalGas - currentTotalGas;
    const percentageDifference = ((baselineTotalGas - currentTotalGas) / baselineTotalGas) * 100;

    const resultsDir = path.join(__dirname, "..", "..", "journal_experiments", "gas");
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const jsonReport = {
      timestamp: new Date().toISOString(),
      environment: "Hardhat Local Network",
      iterations: ITERATIONS,
      metrics: stats,
      comparison: {
        baselineDefinition: "Controlled baseline architecture in which a Merkle root is anchored on-chain after each of the four lifecycle stages.",
        currentDesignDefinition: "The current HerbTrace design where the completed root is anchored at the final transfer stage.",
        baselineAnchorTransactions: 4,
        currentAnchorTransactions: 1,
        currentTotalGas,
        baselineTotalGas,
        absoluteGasDifference,
        percentageDifference
      }
    };

    fs.writeFileSync(path.join(resultsDir, "benchmark_results.json"), JSON.stringify(jsonReport, null, 2));

    const mdReport = `# HerbTrace Gas Consumption Benchmark Report

## 1. Experiment Objective
Measure actual gas consumption of the current HerbTrace smart contract and compare it against a controlled baseline architecture that anchors one Merkle root after every lifecycle stage.

## 2. Research Question Addressed
What is the measured gas difference between anchoring Merkle roots at every stage (baseline) versus anchoring once at the final stage (current design)?

## 3. Experimental Environment
- **Network**: Hardhat Local Network
- **Contract**: \`HerbTrace.sol\`
- **Timestamp**: ${jsonReport.timestamp}

## 4. Smart Contract Functions Tested
- \`createBatch\`
- \`recordTest\`
- \`processBatch\`
- \`transferCustody\`
- \`anchorMerkleRoot\`
- \`recordLocationVerification\` (benchmarked separately)

## 5. Benchmark Procedure
The benchmark executed ${ITERATIONS} independent valid batch lifecycles. A fresh contract was deployed, roles were granted, and operations were called sequentially using synthetic deterministic data. The actual \`gasUsed\` was recorded from transaction receipts.

## 6. Sample Size
- **Iterations per function**: ${ITERATIONS}

## 7. Statistical Summary & Raw Gas Measurements
| Function | Min Gas | Max Gas | Mean Gas | Median Gas | Std Dev |
|---|---|---|---|---|---|
| \`createBatch\` | ${stats.createBatch.min} | ${stats.createBatch.max} | ${stats.createBatch.mean.toFixed(2)} | ${stats.createBatch.median} | ${stats.createBatch.stdDev.toFixed(2)} |
| \`recordTest\` | ${stats.recordTest.min} | ${stats.recordTest.max} | ${stats.recordTest.mean.toFixed(2)} | ${stats.recordTest.median} | ${stats.recordTest.stdDev.toFixed(2)} |
| \`processBatch\` | ${stats.processBatch.min} | ${stats.processBatch.max} | ${stats.processBatch.mean.toFixed(2)} | ${stats.processBatch.median} | ${stats.processBatch.stdDev.toFixed(2)} |
| \`transferCustody\` | ${stats.transferCustody.min} | ${stats.transferCustody.max} | ${stats.transferCustody.mean.toFixed(2)} | ${stats.transferCustody.median} | ${stats.transferCustody.stdDev.toFixed(2)} |
| \`anchorMerkleRoot\` | ${stats.anchorMerkleRoot.min} | ${stats.anchorMerkleRoot.max} | ${stats.anchorMerkleRoot.mean.toFixed(2)} | ${stats.anchorMerkleRoot.median} | ${stats.anchorMerkleRoot.stdDev.toFixed(2)} |
| \`recordLocationVerification\` | ${stats.recordLocationVerification.min} | ${stats.recordLocationVerification.max} | ${stats.recordLocationVerification.mean.toFixed(2)} | ${stats.recordLocationVerification.median} | ${stats.recordLocationVerification.stdDev.toFixed(2)} |

## 8. Controlled Baseline Definition
Controlled baseline architecture in which a Merkle root is anchored on-chain after each of the four lifecycle stages. Constructed analytically as 4 × measured anchor gas.

## 9. Current Design Definition
The current HerbTrace design where the four lifecycle stages are represented in one Merkle structure and the completed root is anchored at the final transfer stage (1 × measured anchor gas).

## 10. Baseline vs Current Comparison
- **Baseline Anchor Transactions**: 4
- **Current Anchor Transactions**: 1
- **Baseline Total Gas**: ${baselineTotalGas.toFixed(2)}
- **Current Total Gas**: ${currentTotalGas.toFixed(2)}
- **Absolute Gas Difference**: ${absoluteGasDifference.toFixed(2)}
- **Percentage Difference**: ${percentageDifference.toFixed(2)}%

## 11. Interpretation of Results
The controlled baseline required 4 anchor transactions, whereas the current design required 1 anchor transaction, resulting in a measured difference of ${absoluteGasDifference.toFixed(2)} gas under the benchmark conditions. This represents a ${percentageDifference.toFixed(2)}% reduction in gas consumption for the overall lifecycle compared to the analytical baseline.

## 12. Threats to Validity
- The baseline is constructed analytically (multiplying the cost of \`anchorMerkleRoot\` by 4) rather than executing a distinct smart contract variant.
- Benchmark data is synthetic and string sizes (e.g., batch IDs, location strings) may slightly influence gas costs in a real-world scenario.
- Network base fee and priority fee fluctuations are not captured since testing occurred on a local Hardhat network.

## 13. Reproducibility Instructions
1. Navigate to \`herbtrace-contracts\`
2. Run \`npx hardhat test test/Benchmark.gas.test.js\`
3. Review the outputs in \`journal_experiments/gas/\`
`;

    fs.writeFileSync(path.join(resultsDir, "benchmark_report.md"), mdReport);
  });
});
