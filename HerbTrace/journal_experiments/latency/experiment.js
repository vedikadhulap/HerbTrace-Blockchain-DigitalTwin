const fs = require("fs");
const path = require("path");
const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Parse arguments
const args = process.argv.slice(2);
const isModeReal = args.includes("--mode=real");
console.log(`Starting experiment in ${isModeReal ? "REAL ORACLE" : "CONTROLLED/MOCK ORACLE"} mode.`);

// Load env vars, explicitly override ENABLE_MULTI_ORACLE
require("dotenv").config({ path: path.join(__dirname, "..", "..", "herbtrace-backend", ".env") });
process.env.ENABLE_MULTI_ORACLE = "true";
process.env.ENABLE_MERKLE_ANCHORING = "true";

// ─── Global Trace Array ───────────────────────────────────────────────────────
global.latencyTraces = [];
global.failedRuns = 0;
global.successfulRuns = 0;

function recordTrace(component, operation, duration) {
  global.latencyTraces.push({ component, operation, durationMs: duration });
}

// ─── Monkey Patch Mongoose Models (MongoDB latency) ──────────────────────────
const Batch = require("../../herbtrace-backend/models/Batch");
const BatchMerkleRoot = require("../../herbtrace-backend/models/BatchMerkleRoot");
const LocationVerification = require("../../herbtrace-backend/models/LocationVerification");

function patchModel(Model, modelName) {
  const methods = ['create', 'findOne', 'find', 'findOneAndUpdate'];
  methods.forEach(method => {
    const original = Model[method];
    if (original) {
      Model[method] = async function (...mArgs) {
        const start = Date.now();
        const result = await original.apply(this, mArgs);
        recordTrace('MongoDB', `${modelName}.${method}`, Date.now() - start);
        return result;
      };
    }
  });
  const originalSave = Model.prototype.save;
  Model.prototype.save = async function (...mArgs) {
    const start = Date.now();
    const result = await originalSave.apply(this, mArgs);
    recordTrace('MongoDB', `${modelName}.save`, Date.now() - start);
    return result;
  };
}

patchModel(Batch, 'Batch');
patchModel(BatchMerkleRoot, 'BatchMerkleRoot');
patchModel(LocationVerification, 'LocationVerification');

// ─── Monkey Patch Blockchain (Ethers Contract & tx.wait) ──────────────────────
const blockchainService = require("../../herbtrace-backend/services/blockchainService");
const originalGetContract = blockchainService.getContract;
blockchainService.getContract = function (role) {
  const contract = originalGetContract(role);
  if (!contract.__patched) {
    ['createBatch', 'recordTest', 'processBatch', 'transferCustody', 'anchorMerkleRoot'].forEach(method => {
      if (typeof contract[method] === 'function') {
        const origMethod = contract[method];
        contract[method] = async function (...mArgs) {
          const submissionStart = Date.now();
          const tx = await origMethod.apply(this, mArgs);
          const submissionLatency = Date.now() - submissionStart;
          
          recordTrace('Blockchain', `Submission (${method})`, submissionLatency);
          
          if (tx && typeof tx.wait === 'function') {
            const originalWait = tx.wait;
            tx.wait = async function (...waitArgs) {
              const waitStart = Date.now();
              const receipt = await originalWait.apply(this, waitArgs);
              const waitLatency = Date.now() - waitStart;
              recordTrace('Blockchain', `Receipt Confirmation (wait)`, waitLatency);
              return receipt;
            };
          }
          return tx;
        };
      }
    });
    contract.__patched = true;
  }
  return contract;
};

// ─── Monkey Patch Multi-Oracle (Oracle latency) ──────────────────────────────
const multiOracleService = require("../../herbtrace-backend/services/multiOracleService");
const originalRunConsensus = multiOracleService.runConsensus;
multiOracleService.runConsensus = async function (lat, lon, typedLoc) {
  if (isModeReal) {
    const start = Date.now();
    const res = await originalRunConsensus.apply(this, [lat, lon, typedLoc]);
    recordTrace('Oracle', 'Total Aggregation', Date.now() - start);
    return res;
  } else {
    // Mode A: Mock Oracle to prevent network wait and failures
    const start = Date.now();
    const res = {
      consensus: "verified",
      confidence: 100,
      verified: true,
      agreedLocation: "Pune, Maharashtra",
      typedMatches: true,
      successCount: 4,
      failureCount: 0,
      thresholdM: 100,
      oracleResults: [],
      agreementPairs: []
    };
    // Emulate a tiny delay to represent local computation, though essentially instant
    recordTrace('Oracle', 'Total Aggregation (Mocked)', Date.now() - start);
    return res;
  }
};

// ─── Monkey Patch Merkle (Merkle latency) ────────────────────────────────────
const merkleService = require("../../herbtrace-backend/services/merkleService");
const originalBuildMerkleTree = merkleService.buildMerkleTree;
merkleService.buildMerkleTree = function (...mArgs) {
  const start = Date.now();
  const res = originalBuildMerkleTree.apply(this, mArgs);
  recordTrace('Merkle', 'buildMerkleTree', Date.now() - start);
  return res;
};

// ─── Setup Express App for HTTP Testing ───────────────────────────────────────
const app = express();
app.use(express.json());

// Bypass authentication safely
require("../../herbtrace-backend/middleware/authMiddleware");
require.cache[require.resolve("../../herbtrace-backend/middleware/authMiddleware")].exports = (role) => (req, res, next) => {
  req.user = { userId: "6491a329d47a4f0012a83e05", role: role || "admin" };
  next();
};

const batchRoutes = require("../../herbtrace-backend/routes/batchRoutes");
app.use("/batch", batchRoutes);

// ─── Helper: Aggregation ─────────────────────────────────────────────────────
function calculateStats(durations) {
  if (!durations || durations.length === 0) return null;
  durations.sort((a, b) => a - b);
  const sum = durations.reduce((acc, v) => acc + v, 0);
  const min = durations[0];
  const max = durations[durations.length - 1];
  const mean = sum / durations.length;
  const mid = Math.floor(durations.length / 2);
  const median = durations.length % 2 !== 0 ? durations[mid] : (durations[mid - 1] + durations[mid]) / 2;
  
  const variance = durations.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  
  const p95Idx = Math.floor(durations.length * 0.95);
  const p95 = durations[p95Idx];
  
  return {
    runs: durations.length,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    unit: 'ms'
  };
}

// ─── Execute Lifecycle Runs ──────────────────────────────────────────────────
async function runLifecycle(iteration, isWarmup = false) {
  const batchId = `LATENCY-BATCH-${isModeReal ? 'REAL' : 'MOCK'}-${iteration}-${Date.now()}`;
  const reqData = {
    create: { batchId, herbType: "Ashwagandha", farmerWallet: "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8", farmLocation: "Pune, Maharashtra", quantityKg: 100, latitude: 18.5204, longitude: 73.8567, userId: "6491a329d47a4f0012a83e01" },
    test: { batchId, testResults: JSON.stringify({ passed: true }), labWallet: "0x20Fe2c5d074128b6c411BAF5CF704863C7764e50", latitude: 18.5204, longitude: 73.8567, userId: "6491a329d47a4f0012a83e02" },
    process: { newBatchId: `${batchId}-PROC`, parentBatchIds: [batchId], processorNotes: JSON.stringify({ dried: true }), latitude: 18.5204, longitude: 73.8567, userId: "6491a329d47a4f0012a83e03" },
    transfer: { batchId: `${batchId}-PROC`, newOwner: "0x2999b14C8B373Aea1bAaC0e2879fc497a479F761", senderRole: "processor", transferData: JSON.stringify({ shipping: "FedEx" }), latitude: 18.5204, longitude: 73.8567, userId: "6491a329d47a4f0012a83e04" }
  };

  const executeEndpoint = async (route, payload) => {
    const startHTTP = Date.now();
    const res = await request(app).post(route).send(payload);
    const durationHTTP = Date.now() - startHTTP;
    
    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Endpoint ${route} failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    }
    
    if (!isWarmup) {
      recordTrace('HTTP', `POST ${route}`, durationHTTP);
    }
    return res;
  };

  let runSuccess = true;
  const startFullLifecycle = Date.now();
  
  try {
    await executeEndpoint("/batch/", reqData.create);
    await executeEndpoint("/batch/lab-test", reqData.test);
    await executeEndpoint("/batch/process", reqData.process);
    await executeEndpoint("/batch/transfer", reqData.transfer);
  } catch (err) {
    runSuccess = false;
    console.error(`[Lifecycle Failed] Iteration ${iteration}: ${err.message}`);
  }
  
  const totalLifecycleDuration = Date.now() - startFullLifecycle;
  
  if (!isWarmup) {
    if (runSuccess) {
      global.successfulRuns++;
      recordTrace('HTTP', 'Full Lifecycle Execution', totalLifecycleDuration);
    } else {
      global.failedRuns++;
    }
  }

  // To prevent aggressive API limits in REAL mode, add a delay
  if (isModeReal) {
    await new Promise(r => setTimeout(r, 2000));
  }
}

// ─── Main Execution ──────────────────────────────────────────────────────────
async function main() {
  const WARMUPS = 0; 
  const RUNS = isModeReal ? 3 : 5;
  
  // Setup In-Memory MongoDB
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  if (WARMUPS > 0) {
    console.log(`Executing ${WARMUPS} warm-up runs...`);
    for (let i = 0; i < WARMUPS; i++) {
      await runLifecycle(i, true);
    }
  }

  global.latencyTraces = [];

  console.log(`Executing ${RUNS} measured runs...`);
  for (let i = 0; i < RUNS; i++) {
    console.log(`Running iteration ${i + 1}/${RUNS}...`);
    await runLifecycle(i, false);
  }

  // Aggregate results
  const grouped = {};
  global.latencyTraces.forEach(t => {
    const key = `${t.component}::${t.operation}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t.durationMs);
  });

  const finalStats = {};
  for (const [key, durations] of Object.entries(grouped)) {
    const [comp, op] = key.split("::");
    if (!finalStats[comp]) finalStats[comp] = {};
    finalStats[comp][op] = calculateStats(durations);
  }

  // Generate Reports
  const outputDir = path.join(__dirname, "..", "..", "journal_experiments", "latency");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultPrefix = isModeReal ? "real" : "mock";

  const jsonReport = {
    timestamp: new Date().toISOString(),
    environment: {
      mode: isModeReal ? "Real External-Oracle Mode" : "Controlled/Mock-Oracle Mode",
      blockchain: "Local Hardhat",
      database: "Local MongoDB Memory Server"
    },
    runs: {
      attempted: RUNS,
      successful: global.successfulRuns,
      failed: global.failedRuns
    },
    statistics: finalStats
  };

  fs.writeFileSync(path.join(outputDir, `latency_results_${resultPrefix}.json`), JSON.stringify(jsonReport, null, 2));

  console.log(`Latency benchmark completed. Success: ${global.successfulRuns}, Failed: ${global.failedRuns}`);

  await mongoose.disconnect();
  await mongoServer.stop();
}

main().catch(console.error);
