/**
 * ============================================================
 * oracleReputationService.test.js — Unit Tests
 * ============================================================
 *
 * Tests:
 *   1. All oracles agree -> reputations remain high (1.0)
 *   2. One 500m outlier -> outlier reputation decreases via EMA
 *   3. Repeated bad behavior -> reputation continues dropping towards 0
 *   4. Reputation recovery -> when outlier starts agreeing again, reputation recovers
 *   5. All-oracle disagreement -> no agreement, reputations drop accordingly
 *
 * Run with: node tests/oracleReputationService.test.js
 */

const assert = require("assert");
const {
  evaluateLeaveOneOutAgreement,
  updateOracleReputations,
  calculateReputationWeightedConsensus,
  REPUTATION_ALPHA,
} = require("../services/oracleReputationService");

let passed = 0;
let failed = 0;

const test = (name, fn) => {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
};

console.log("\n🧪 oracleReputationService.test.js — Reputation Consensus Unit Tests\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Test Oracles Setup
// Pune Ground Truth: (18.5204, 73.8567)
// Outlier 500m away: (18.5249, 73.8567)

const accurateResults = [
  { oracle: "nominatim", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "bigdatacloud", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "geocode.maps.co", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "opencage", rawLat: 18.5204, rawLon: 73.8567, success: true },
];

const outlierResults = [
  { oracle: "nominatim", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "bigdatacloud", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "geocode.maps.co", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "opencage", rawLat: 18.5249, rawLon: 73.8567, success: true }, // ~500m outlier
];

const totalDisagreementResults = [
  { oracle: "nominatim", rawLat: 18.5204, rawLon: 73.8567, success: true },
  { oracle: "bigdatacloud", rawLat: 19.0760, rawLon: 72.8777, success: true }, // Mumbai (~120km)
  { oracle: "geocode.maps.co", rawLat: 28.6139, rawLon: 77.2090, success: true }, // Delhi (~1000km)
  { oracle: "opencage", rawLat: 12.9716, rawLon: 77.5946, success: true }, // Bengaluru (~800km)
];

console.log("📌 Suite 1: All Oracles Agree");

test("All 4 oracles agree -> agreement = 1 for all", () => {
  const agreements = evaluateLeaveOneOutAgreement(accurateResults);
  assert.strictEqual(agreements.nominatim, 1);
  assert.strictEqual(agreements.bigdatacloud, 1);
  assert.strictEqual(agreements["geocode.maps.co"], 1);
  assert.strictEqual(agreements.opencage, 1);
});

test("All 4 oracles agree -> reputations stay at 1.0", () => {
  const { updatedReputations } = updateOracleReputations(accurateResults, {
    nominatim: 1.0,
    bigdatacloud: 1.0,
    "geocode.maps.co": 1.0,
    opencage: 1.0,
  });
  assert.strictEqual(updatedReputations.nominatim, 1.0);
  assert.strictEqual(updatedReputations.opencage, 1.0);
});

console.log("\n📌 Suite 2: One 500m Outlier");

test("One oracle 500m away -> outlier gets agreement = 0, others get 1", () => {
  const agreements = evaluateLeaveOneOutAgreement(outlierResults);
  assert.strictEqual(agreements.nominatim, 1);
  assert.strictEqual(agreements.bigdatacloud, 1);
  assert.strictEqual(agreements["geocode.maps.co"], 1);
  assert.strictEqual(agreements.opencage, 0);
});

test("Outlier reputation drops from 1.0 to 0.8 on first bad round", () => {
  const { updatedReputations } = updateOracleReputations(outlierResults, {
    nominatim: 1.0,
    bigdatacloud: 1.0,
    "geocode.maps.co": 1.0,
    opencage: 1.0,
  });
  assert.strictEqual(updatedReputations.opencage, 0.8);
  assert.strictEqual(updatedReputations.nominatim, 1.0);
});

console.log("\n📌 Suite 3: Repeated Bad Behavior");

test("Repeated bad behavior for 5 rounds continuously decreases reputation", () => {
  let reps = { nominatim: 1.0, bigdatacloud: 1.0, "geocode.maps.co": 1.0, opencage: 1.0 };
  for (let round = 1; round <= 5; round++) {
    const { updatedReputations } = updateOracleReputations(outlierResults, reps);
    reps = updatedReputations;
  }
  // Expected after 5 rounds: 0.8^5 = 0.32768 -> rounded ~0.3277
  assert.ok(reps.opencage < 0.35, `Reputation should drop below 0.35, got ${reps.opencage}`);
});

console.log("\n📌 Suite 4: Reputation Recovery");

test("Outlier recovers reputation when it resumes providing accurate data", () => {
  let reps = { nominatim: 1.0, bigdatacloud: 1.0, "geocode.maps.co": 1.0, opencage: 0.3277 };
  // 5 accurate rounds
  for (let round = 1; round <= 5; round++) {
    const { updatedReputations } = updateOracleReputations(accurateResults, reps);
    reps = updatedReputations;
  }
  // Should recover towards 1.0
  assert.ok(reps.opencage > 0.7, `Reputation should recover above 0.7, got ${reps.opencage}`);
});

console.log("\n📌 Suite 5: All-Oracle Disagreement");

test("All 4 oracles disagree completely -> verified = false", () => {
  const res = calculateReputationWeightedConsensus(totalDisagreementResults);
  assert.strictEqual(res.verified, false);
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
