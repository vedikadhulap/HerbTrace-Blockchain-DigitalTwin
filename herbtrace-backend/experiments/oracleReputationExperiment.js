/**
 * ============================================================
 * Experiment 1: Reputation-Weighted Oracle Consensus
 * ============================================================
 *
 * Runs a 20-round simulation comparing plain 2-of-4 majority consensus
 * vs. reputation-weighted consensus using Leave-One-Out EMA tracking.
 *
 * Scenario:
 *   - 3 oracles (nominatim, bigdatacloud, geocode.maps.co) return correct GPS (Pune: 18.5204, 73.8567).
 *   - 1 oracle (opencage) returns coordinates approx 500m away (18.5249, 73.8567).
 *
 * Execution command:
 *   node experiments/oracleReputationExperiment.js
 */

const {
  updateOracleReputations,
  calculateReputationWeightedConsensus,
  REPUTATION_ALPHA,
} = require("../services/oracleReputationService");

const { haversineDistance, AGREEMENT_THRESHOLD_METERS } = require("../services/multiOracleService");

function runExperiment() {
  console.log("=========================================================================");
  console.log("  HERBTRACE EXPERIMENT 1: REPUTATION-WEIGHTED ORACLE CONSENSUS");
  console.log("=========================================================================\n");

  const TOTAL_ROUNDS = 20;

  // Baseline ground truth location (Pune, MH)
  const GROUND_TRUTH = {
    name: "Ground Truth (Pune)",
    lat: 18.5204,
    lon: 73.8567,
  };

  // 3 Accurate Oracles + 1 Faulty/Outlier Oracle (500m away)
  // Distance between (18.5204, 73.8567) and (18.5249, 73.8567) is ~500 meters
  const oracleConfig = [
    { oracle: "nominatim", lat: 18.5204, lon: 73.8567, isAccurate: true },
    { oracle: "bigdatacloud", lat: 18.5204, lon: 73.8567, isAccurate: true },
    { oracle: "geocode.maps.co", lat: 18.5204, lon: 73.8567, isAccurate: true },
    { oracle: "opencage", lat: 18.5249, lon: 73.8567, isAccurate: false }, // Outlier (~500m)
  ];

  const outlierOracleName = "opencage";

  let currentReputations = {
    nominatim: 1.0,
    bigdatacloud: 1.0,
    "geocode.maps.co": 1.0,
    opencage: 1.0,
  };

  const initialOutlierRep = currentReputations[outlierOracleName];

  let plainMajorityCorrectRounds = 0;
  let plainMajorityIncorrectRounds = 0;
  let weightedCorrectRounds = 0;
  let weightedIncorrectRounds = 0;

  const roundLogs = [];

  console.log(`Starting 20-Round Simulation (Alpha = ${REPUTATION_ALPHA})...\n`);
  console.log(
    "Round | Oracle           | Coords             | Rep Before | Agreement | Rep After | Majority | Weighted"
  );
  console.log(
    "--------------------------------------------------------------------------------------------------------"
  );

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    // Build oracle result objects
    const oracleResults = oracleConfig.map((o) => ({
      oracle: o.oracle,
      rawLat: o.lat,
      rawLon: o.lon,
      city: o.isAccurate ? "Pune" : "Off-target",
      displayName: o.isAccurate ? "Pune, Maharashtra" : "Far Away, Maharashtra",
      success: true,
    }));

    // A. Plain Majority Consensus check (Count pairs within 100m)
    let majorityAgreements = 0;
    const successful = oracleResults.filter((r) => r.success);
    for (let i = 0; i < successful.length; i++) {
      for (let j = i + 1; j < successful.length; j++) {
        const d = haversineDistance(
          successful[i].rawLat,
          successful[i].rawLon,
          successful[j].rawLat,
          successful[j].rawLon
        );
        if (d <= AGREEMENT_THRESHOLD_METERS) {
          majorityAgreements++;
        }
      }
    }
    const plainMajorityVerified = majorityAgreements >= 1;
    if (plainMajorityVerified) {
      plainMajorityCorrectRounds++;
    } else {
      plainMajorityIncorrectRounds++;
    }

    // B. Reputation-Weighted Consensus
    const weightedResult = calculateReputationWeightedConsensus(
      oracleResults,
      currentReputations,
      REPUTATION_ALPHA
    );

    const weightedVerified = weightedResult.verified;
    // Check if winning cluster latitude/longitude is close to ground truth (< 100m)
    const distToGroundTruth = weightedVerified
      ? haversineDistance(
          weightedResult.latitude,
          weightedResult.longitude,
          GROUND_TRUTH.lat,
          GROUND_TRUTH.lon
        )
      : 999999;

    const weightedIsCorrect = weightedVerified && distToGroundTruth <= AGREEMENT_THRESHOLD_METERS;

    if (weightedIsCorrect) {
      weightedCorrectRounds++;
    } else {
      weightedIncorrectRounds++;
    }

    // Capture per-oracle updates for logging
    const repBefore = { ...currentReputations };
    const agreements = weightedResult.agreements;
    currentReputations = weightedResult.reputations;

    oracleConfig.forEach((o) => {
      const name = o.oracle;
      const rBefore = repBefore[name].toFixed(4);
      const agreeVal = agreements[name];
      const rAfter = currentReputations[name].toFixed(4);
      const coordsStr = `${o.lat},${o.lon}`;

      console.log(
        `${String(round).padStart(5)} | ${name.padEnd(16)} | ${coordsStr.padEnd(18)} | ${String(
          rBefore
        ).padStart(10)} | ${String(agreeVal).padStart(9)} | ${String(rAfter).padStart(
          9
        )} | ${plainMajorityVerified ? "PASS" : "FAIL"}     | ${weightedIsCorrect ? "PASS" : "FAIL"}`
      );

      roundLogs.push({
        round,
        oracle: name,
        coords: coordsStr,
        reputationBefore: repBefore[name],
        agreement: agreeVal,
        reputationAfter: currentReputations[name],
        majorityResult: plainMajorityVerified,
        weightedResult: weightedIsCorrect,
      });
    });

    console.log(
      "--------------------------------------------------------------------------------------------------------"
    );
  }

  const finalOutlierRep = currentReputations[outlierOracleName];
  const reputationChange = Math.round((finalOutlierRep - initialOutlierRep) * 10000) / 10000;

  console.log("\n=========================================================================");
  console.log("  EXPERIMENT SUMMARY RESULTS");
  console.log("=========================================================================");
  console.log(`Total Simulation Rounds              : ${TOTAL_ROUNDS}`);
  console.log(`Plain Majority Correct Rounds        : ${plainMajorityCorrectRounds}`);
  console.log(`Plain Majority Incorrect Rounds      : ${plainMajorityIncorrectRounds}`);
  console.log(`Weighted Consensus Correct Rounds    : ${weightedCorrectRounds}`);
  console.log(`Weighted Consensus Incorrect Rounds  : ${weightedIncorrectRounds}`);
  console.log(`Initial Outlier (${outlierOracleName}) Rep : ${initialOutlierRep.toFixed(4)}`);
  console.log(`Final Outlier (${outlierOracleName}) Rep   : ${finalOutlierRep.toFixed(4)}`);
  console.log(`Outlier Reputation Delta             : ${reputationChange}`);
  console.log("=========================================================================\n");

  return {
    TOTAL_ROUNDS,
    plainMajorityCorrectRounds,
    plainMajorityIncorrectRounds,
    weightedCorrectRounds,
    weightedIncorrectRounds,
    initialOutlierRep,
    finalOutlierRep,
    reputationChange,
    roundLogs,
  };
}

if (require.main === module) {
  runExperiment();
}

module.exports = { runExperiment };
