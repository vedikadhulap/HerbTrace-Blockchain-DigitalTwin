/**
 * ============================================================
 * Experiment 2: Spatiotemporal Fraud Detection
 * ============================================================
 *
 * Runs 10 synthetic test scenarios evaluating the spatiotemporal fraud detector.
 *
 * Scenarios included:
 *   1. Normal movement (50 km in 2 hours -> 25 km/h)
 *   2. Speed >120 km/h (300 km in 1.5 hours -> 200 km/h)
 *   3. Extreme distance + short time (1000 km in 0.5 hours -> 2000 km/h)
 *   4. Reasonable short movement (10 km in 0.5 hours -> 20 km/h)
 *   5. Long time gap (100 km in 48 hours -> 2.08 km/h)
 *   6. Borderline case (115 km in 1 hour -> 115 km/h)
 *   7. Clearly suspicious case (500 km in 0.1 hours -> 5000 km/h)
 *   8. Missing GPS coordinates
 *   9. Missing timestamp
 *  10. Zero / negative time gap
 *
 * Execution command:
 *   node experiments/spatiotemporalFraudExperiment.js
 */

const {
  checkStageTransitionFraud,
  MAX_REASONABLE_SPEED_KMH,
} = require("../services/spatiotemporalFraudService");

function runFraudExperiment() {
  console.log("=========================================================================");
  console.log("  HERBTRACE EXPERIMENT 2: SPATIOTEMPORAL FRAUD DETECTION");
  console.log("=========================================================================\n");

  const baseTime = new Date("2026-09-25T10:00:00Z").getTime();

  // Coordinates:
  // Pune: (18.5204, 73.8567)
  // Lonavala: (18.7557, 73.4091) ~50 km from Pune
  // Mumbai: (19.0760, 72.8777) ~120 km from Pune
  // Nagpur: (21.1458, 79.0882) ~500 km from Pune
  // Delhi: (28.6139, 77.2090) ~1000 km from Pune

  const scenarios = [
    {
      id: 1,
      name: "Normal Movement (50 km in 2h)",
      expectedCategory: "NORMAL",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 18.7557, longitude: 73.4091, timestamp: new Date(baseTime + 2 * 3600000).toISOString() },
    },
    {
      id: 2,
      name: "Speed >120 km/h (300 km in 1.5h)",
      expectedCategory: "FRAUD",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 19.8762, longitude: 75.3433, timestamp: new Date(baseTime + 1.5 * 3600000).toISOString() }, // Aurangabad ~300km
    },
    {
      id: 3,
      name: "Extreme Distance + Short Time (1000 km in 0.5h)",
      expectedCategory: "FRAUD",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 28.6139, longitude: 77.2090, timestamp: new Date(baseTime + 0.5 * 3600000).toISOString() },
    },
    {
      id: 4,
      name: "Reasonable Short Movement (10 km in 0.5h)",
      expectedCategory: "NORMAL",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 18.5904, longitude: 73.8567, timestamp: new Date(baseTime + 0.5 * 3600000).toISOString() },
    },
    {
      id: 5,
      name: "Long Time Gap (100 km in 48h)",
      expectedCategory: "NORMAL",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime + 48 * 3600000).toISOString() },
    },
    {
      id: 6,
      name: "Borderline Case (115 km in 1h)",
      expectedCategory: "NORMAL",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 19.0000, longitude: 72.9000, timestamp: new Date(baseTime + 1.0 * 3600000).toISOString() },
    },
    {
      id: 7,
      name: "Clearly Suspicious Case (500 km in 0.1h)",
      expectedCategory: "FRAUD",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 21.1458, longitude: 79.0882, timestamp: new Date(baseTime + 0.1 * 3600000).toISOString() },
    },
    {
      id: 8,
      name: "Missing GPS Coordinates",
      expectedCategory: "INSUFFICIENT_DATA",
      prev: { latitude: null, longitude: null, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime + 2 * 3600000).toISOString() },
    },
    {
      id: 9,
      name: "Missing Timestamp",
      expectedCategory: "INSUFFICIENT_DATA",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: null },
      curr: { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime + 2 * 3600000).toISOString() },
    },
    {
      id: 10,
      name: "Zero / Invalid Time Gap",
      expectedCategory: "INSUFFICIENT_DATA",
      prev: { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() },
      curr: { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime).toISOString() }, // 0 time gap
    },
  ];

  let totalScenarios = scenarios.length;
  let fraudScenarios = 0;
  let normalScenarios = 0;
  let insufficientDataScenarios = 0;

  let detectedFraud = 0; // True Positives
  let missedFraud = 0;   // False Negatives
  let falsePositives = 0;

  console.log(
    "ID | Scenario Description                     | Expected        | Status            | Speed (km/h) | Suspicious | Result Match"
  );
  console.log(
    "-------------------------------------------------------------------------------------------------------------------------------"
  );

  scenarios.forEach((sc) => {
    if (sc.expectedCategory === "FRAUD") fraudScenarios++;
    else if (sc.expectedCategory === "NORMAL") normalScenarios++;
    else if (sc.expectedCategory === "INSUFFICIENT_DATA") insufficientDataScenarios++;

    const result = checkStageTransitionFraud(
      sc.prev,
      sc.curr,
      `Scenario ${sc.id}`,
      MAX_REASONABLE_SPEED_KMH
    );

    let match = false;
    if (sc.expectedCategory === "FRAUD") {
      if (result.status === "checked" && result.suspicious === true) {
        detectedFraud++;
        match = true;
      } else {
        missedFraud++;
      }
    } else if (sc.expectedCategory === "NORMAL") {
      if (result.status === "checked" && result.suspicious === false) {
        match = true;
      } else if (result.suspicious === true) {
        falsePositives++;
      }
    } else if (sc.expectedCategory === "INSUFFICIENT_DATA") {
      if (result.status === "insufficient_data" && result.suspicious === false) {
        match = true;
      }
    }

    const speedStr = result.impliedSpeedKmh !== undefined ? String(result.impliedSpeedKmh) : "N/A";
    const suspStr = String(result.suspicious);
    const matchStr = match ? "✅ PASS" : "❌ FAIL";

    console.log(
      `${String(sc.id).padStart(2)} | ${sc.name.padEnd(40)} | ${sc.expectedCategory.padEnd(15)} | ${result.status.padEnd(17)} | ${speedStr.padEnd(12)} | ${suspStr.padEnd(10)} | ${matchStr}`
    );
  });

  console.log(
    "-------------------------------------------------------------------------------------------------------------------------------"
  );

  const detectionRate = fraudScenarios > 0 ? (detectedFraud / fraudScenarios) * 100 : 0;
  const falsePositiveRate = normalScenarios > 0 ? (falsePositives / normalScenarios) * 100 : 0;

  console.log("\n=========================================================================");
  console.log("  SPATIOTEMPORAL FRAUD EXPERIMENT METRICS");
  console.log("=========================================================================");
  console.log(`Total Scenarios              : ${totalScenarios}`);
  console.log(`Fraud Scenarios (Ground)     : ${fraudScenarios}`);
  console.log(`Normal Scenarios (Ground)    : ${normalScenarios}`);
  console.log(`Insufficient Data Scenarios  : ${insufficientDataScenarios}`);
  console.log(`Detected Fraud (TP)          : ${detectedFraud}`);
  console.log(`Missed Fraud (FN)            : ${missedFraud}`);
  console.log(`False Positives (FP)         : ${falsePositives}`);
  console.log(`False Negatives (FN)         : ${missedFraud}`);
  console.log(`Detection Rate (Recall)      : ${detectionRate.toFixed(2)}%`);
  console.log(`False Positive Rate          : ${falsePositiveRate.toFixed(2)}%`);
  console.log("=========================================================================\n");

  return {
    totalScenarios,
    fraudScenarios,
    normalScenarios,
    insufficientDataScenarios,
    detectedFraud,
    missedFraud,
    falsePositives,
    falseNegatives: missedFraud,
    detectionRate,
    falsePositiveRate,
  };
}

if (require.main === module) {
  runFraudExperiment();
}

module.exports = { runFraudExperiment };
