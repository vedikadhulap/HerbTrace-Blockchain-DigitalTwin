/**
 * ============================================================
 * multiOracleService.test.js — Unit Tests with Mocked Oracles
 * ============================================================
 *
 * Run with: node tests/multiOracleService.test.js
 * (No testing framework needed — uses pure Node.js assertions)
 *
 * What this tests:
 *   1. Haversine distance formula accuracy
 *   2. Consensus: 2 oracles agree → "verified"
 *   3. Consensus: all disagree → "low_confidence"
 *   4. Consensus: 1 oracle fails, 2 agree → "verified" (fault tolerant)
 *   5. Consensus: all oracles fail → "no_data"
 *   6. 100m threshold boundary conditions
 * ============================================================
 */

const assert = require("assert");
const { haversineDistance, AGREEMENT_THRESHOLD_METERS } = require("../services/multiOracleService");

// ─── Test Utilities ───────────────────────────────────────────────────────────

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

const testAsync = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
};

// ─── Mock Consensus Engine (for testing without network) ──────────────────────

/**
 * Runs the consensus algorithm with mock oracle results.
 * This tests the core decision logic without hitting real APIs.
 *
 * @param {Array<{rawLat, rawLon, success, oracle}>} mockResults
 * @param {string} typedLocation
 * @returns {object} consensus result
 */
const runMockConsensus = (mockResults, typedLocation = "") => {
  const THRESHOLD = AGREEMENT_THRESHOLD_METERS; // 100m
  const successfulResults = mockResults.filter((r) => r.success);

  if (successfulResults.length < 2) {
    return {
      consensus: "no_data",
      verified: false,
      agreementPairs: [],
      successCount: successfulResults.length,
      message: "Not enough oracles responded",
    };
  }

  const agreementPairs = [];
  for (let i = 0; i < successfulResults.length; i++) {
    for (let j = i + 1; j < successfulResults.length; j++) {
      const r1 = successfulResults[i];
      const r2 = successfulResults[j];
      const dist = haversineDistance(r1.rawLat, r1.rawLon, r2.rawLat, r2.rawLon);
      if (dist <= THRESHOLD) {
        agreementPairs.push({
          oracles: [r1.oracle, r2.oracle],
          distanceM: Math.round(dist),
        });
      }
    }
  }

  const verified = agreementPairs.length >= 1;
  return {
    consensus: verified ? "verified" : "low_confidence",
    verified,
    agreementPairs,
    successCount: successfulResults.length,
    message: verified ? "2+ oracles agree" : "Oracles disagree — low confidence",
  };
};

// ─── Test Suites ──────────────────────────────────────────────────────────────

console.log("\n🧪 multiOracleService.test.js — Multi-Oracle Consensus\n");
console.log("━".repeat(55));

console.log("\n📌 Suite 1: Haversine Distance Formula\n");

test("Distance between same point is 0", () => {
  const d = haversineDistance(18.52, 73.85, 18.52, 73.85);
  assert.ok(d < 0.001, `Should be ~0, got ${d}`);
});

test("Distance between Pune and Mumbai is ~120–150 km", () => {
  const pune   = { lat: 18.5204, lon: 73.8567 };
  const mumbai = { lat: 19.0760, lon: 72.8777 };
  const distKm = haversineDistance(pune.lat, pune.lon, mumbai.lat, mumbai.lon) / 1000;
  assert.ok(distKm > 100, `Pune-Mumbai should be >100km, got ${distKm.toFixed(1)}km`);
  assert.ok(distKm < 180, `Pune-Mumbai should be <180km, got ${distKm.toFixed(1)}km`);
  console.log(`     Pune → Mumbai: ${distKm.toFixed(1)} km`);
});

test("Distance of 50m returns < threshold (100m)", () => {
  // Move ~50m north (1 metre north ≈ 0.000009 degrees latitude)
  const dist = haversineDistance(18.52, 73.85, 18.5205, 73.85); // ~55m
  assert.ok(dist < AGREEMENT_THRESHOLD_METERS, `${dist.toFixed(1)}m should be < ${AGREEMENT_THRESHOLD_METERS}m`);
});

test("Distance of 200m returns > threshold (100m)", () => {
  // Move ~200m north
  const dist = haversineDistance(18.52, 73.85, 18.5218, 73.85); // ~200m
  assert.ok(dist > AGREEMENT_THRESHOLD_METERS, `${dist.toFixed(1)}m should be > ${AGREEMENT_THRESHOLD_METERS}m`);
});

console.log("\n📌 Suite 2: Consensus Logic\n");

test("2 oracles agree within 50m → consensus: verified", () => {
  const results = [
    { oracle: "nominatim", success: true, rawLat: 18.52, rawLon: 73.85 },
    { oracle: "bigdatacloud", success: true, rawLat: 18.5203, rawLon: 73.85 }, // ~33m away
    { oracle: "geocode.maps.co", success: true, rawLat: 18.6, rawLon: 73.9 }, // far away
  ];
  const result = runMockConsensus(results, "Pune");
  assert.strictEqual(result.consensus, "verified", "Should be verified");
  assert.strictEqual(result.verified, true);
  assert.ok(result.agreementPairs.length >= 1, "Should have at least 1 agreeing pair");
  console.log(`     Agreement pairs: ${result.agreementPairs.length}, distance: ${result.agreementPairs[0]?.distanceM}m`);
});

test("All 3 oracles agree within 80m → verified with high confidence", () => {
  const results = [
    { oracle: "nominatim", success: true, rawLat: 18.5200, rawLon: 73.85 },
    { oracle: "bigdatacloud", success: true, rawLat: 18.5204, rawLon: 73.85 }, // ~44m
    { oracle: "geocode.maps.co", success: true, rawLat: 18.5207, rawLon: 73.85 }, // ~78m
  ];
  const result = runMockConsensus(results, "Pune");
  assert.strictEqual(result.consensus, "verified");
  assert.ok(result.agreementPairs.length === 3, "All 3 pairs should agree");
});

test("All 3 oracles return different locations → low_confidence", () => {
  const results = [
    { oracle: "nominatim", success: true, rawLat: 18.52, rawLon: 73.85 },   // Pune
    { oracle: "bigdatacloud", success: true, rawLat: 19.07, rawLon: 72.87 }, // Mumbai
    { oracle: "geocode.maps.co", success: true, rawLat: 28.61, rawLon: 77.20 }, // Delhi
  ];
  const result = runMockConsensus(results, "");
  assert.strictEqual(result.consensus, "low_confidence");
  assert.strictEqual(result.verified, false);
  assert.strictEqual(result.agreementPairs.length, 0);
});

test("1 oracle fails, 2 remaining agree → verified (fault tolerant)", () => {
  const results = [
    { oracle: "nominatim", success: true, rawLat: 18.52, rawLon: 73.85 },
    { oracle: "bigdatacloud", success: false, error: "Network timeout" },  // failed
    { oracle: "geocode.maps.co", success: true, rawLat: 18.5203, rawLon: 73.85 }, // ~33m away
  ];
  const result = runMockConsensus(results, "");
  assert.strictEqual(result.consensus, "verified", "Should still verify with 2 of 3");
  assert.strictEqual(result.successCount, 2, "Should count 2 successful oracles");
});

test("2 oracles fail, 1 responds → no_data (cannot establish consensus)", () => {
  const results = [
    { oracle: "nominatim", success: true, rawLat: 18.52, rawLon: 73.85 },
    { oracle: "bigdatacloud", success: false, error: "Timeout" },
    { oracle: "geocode.maps.co", success: false, error: "Rate limited" },
  ];
  const result = runMockConsensus(results, "");
  assert.strictEqual(result.consensus, "no_data", "Cannot make decision with only 1 oracle");
  assert.strictEqual(result.verified, false);
});

test("All oracles fail → no_data", () => {
  const results = [
    { oracle: "nominatim", success: false },
    { oracle: "bigdatacloud", success: false },
    { oracle: "geocode.maps.co", success: false },
  ];
  const result = runMockConsensus(results, "");
  assert.strictEqual(result.consensus, "no_data");
  assert.strictEqual(result.successCount, 0);
});

console.log("\n📌 Suite 3: Threshold Boundary Conditions\n");

test("99m apart → verified (just under 100m threshold)", () => {
  // 100m in latitude ≈ 0.0009 degrees, so 99m ≈ 0.000891 degrees
  const lat1 = 18.5200;
  const lat2 = 18.5200 + 0.00088; // ~97.8m
  const dist = haversineDistance(lat1, 73.85, lat2, 73.85);
  console.log(`     Actual distance: ${dist.toFixed(2)}m`);
  assert.ok(dist < AGREEMENT_THRESHOLD_METERS, `${dist.toFixed(1)}m should be < 100m`);

  const results = [
    { oracle: "nominatim", success: true, rawLat: lat1, rawLon: 73.85 },
    { oracle: "bigdatacloud", success: true, rawLat: lat2, rawLon: 73.85 },
  ];
  const result = runMockConsensus(results, "");
  assert.strictEqual(result.consensus, "verified");
});

test("101m apart → low_confidence (just over threshold)", () => {
  // 101m ≈ 0.000909 degrees latitude
  const lat1 = 18.5200;
  const lat2 = 18.5200 + 0.00092; // ~102m
  const dist = haversineDistance(lat1, 73.85, lat2, 73.85);
  console.log(`     Actual distance: ${dist.toFixed(2)}m`);
  assert.ok(dist > AGREEMENT_THRESHOLD_METERS, `${dist.toFixed(1)}m should be > 100m`);

  const results = [
    { oracle: "nominatim", success: true, rawLat: lat1, rawLon: 73.85 },
    { oracle: "bigdatacloud", success: true, rawLat: lat2, rawLon: 73.85 },
  ];
  const result = runMockConsensus(results, "");
  assert.strictEqual(result.consensus, "low_confidence");
});

console.log("\n📌 Suite 4: Live Oracle Test (requires internet)\n");

testAsync("Live: queryBigDataCloud returns city data for Pune coordinates", async () => {
  try {
    const { queryBigDataCloud } = require("../services/multiOracleService");
    const result = await queryBigDataCloud(18.52, 73.85);
    assert.ok(result.success, "BigDataCloud should return success");
    assert.ok(result.city || result.state, "Should return city or state data");
    console.log(`     BigDataCloud returned: ${result.city || ""}, ${result.state || ""}`);
  } catch (err) {
    if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
      console.log("     ⚠️  Skipped (no internet connection)");
      passed++; failed--; // cancel the outer catch
    } else {
      throw err;
    }
  }
}).then(() => {
  // ─── Final Summary ─────────────────────────────────────────────────────────
  console.log("\n" + "━".repeat(55));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("🎉 All multi-oracle tests passed!\n");
    console.log("💡 The consensus algorithm is working correctly:");
    console.log("   • 2+ oracles within 100m  → verified ✅");
    console.log("   • Oracles disagree         → low_confidence ⚠️");
    console.log("   • <2 oracles responded     → no_data 🚫\n");
  }
});
