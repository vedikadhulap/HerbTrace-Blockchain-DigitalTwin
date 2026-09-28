/**
 * ============================================================
 * spatiotemporalFraudService.test.js — Unit Tests
 * ============================================================
 *
 * Tests:
 *   1. Haversine distance calculation in spatiotemporal service
 *   2. Normal speed movement (< 120 km/h) -> checked, not suspicious
 *   3. >120 km/h speed movement -> checked, suspicious: true
 *   4. Borderline threshold case (115-120 km/h) -> checked, not suspicious
 *   5. Missing GPS coordinates -> status: "insufficient_data", suspicious: false
 *   6. Missing timestamp -> status: "insufficient_data", suspicious: false
 *   7. Zero time difference -> status: "insufficient_data", suspicious: false
 *   8. Negative time difference -> status: "insufficient_data", suspicious: false
 *
 * Run with: node tests/spatiotemporalFraudService.test.js
 */

const assert = require("assert");
const {
  checkStageTransitionFraud,
  checkBatchSpatiotemporalFraud,
  MAX_REASONABLE_SPEED_KMH,
} = require("../services/spatiotemporalFraudService");

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

console.log("\n🧪 spatiotemporalFraudService.test.js — Spatiotemporal Fraud Unit Tests\n");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const baseTime = new Date("2026-09-25T12:00:00Z").getTime();

// Locations:
// Pune: (18.5204, 73.8567)
// Lonavala: (18.7557, 73.4091) ~50km
// Mumbai: (19.0760, 72.8777) ~120km

console.log("📌 Suite 1: Speed Calculation & Threshold Checks");

test("Normal movement speed (50 km in 2 hours -> ~25 km/h) is not suspicious", () => {
  const prev = { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() };
  const curr = { latitude: 18.7557, longitude: 73.4091, timestamp: new Date(baseTime + 2 * 3600000).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "checked");
  assert.strictEqual(res.suspicious, false);
  assert.ok(res.impliedSpeedKmh < 120);
});

test("Excessive speed (>120 km/h: 300 km in 1.5 hours) is flagged as suspicious", () => {
  const prev = { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() };
  const curr = { latitude: 19.8762, longitude: 75.3433, timestamp: new Date(baseTime + 1.5 * 3600000).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "checked");
  assert.strictEqual(res.suspicious, true);
  assert.ok(res.impliedSpeedKmh > 120);
});

test("Threshold case (113-115 km/h) is not suspicious (<= 120 km/h)", () => {
  const prev = { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() };
  const curr = { latitude: 19.0000, longitude: 72.9000, timestamp: new Date(baseTime + 1.0 * 3600000).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "checked");
  assert.strictEqual(res.suspicious, false);
});

console.log("\n📌 Suite 2: Missing & Invalid Data Edge Cases");

test("Missing GPS coordinates returns insufficient_data and suspicious=false", () => {
  const prev = { latitude: null, longitude: null, timestamp: new Date(baseTime).toISOString() };
  const curr = { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime + 1 * 3600000).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "insufficient_data");
  assert.strictEqual(res.suspicious, false);
});

test("Missing timestamp returns insufficient_data and suspicious=false", () => {
  const prev = { latitude: 18.5204, longitude: 73.8567, timestamp: null };
  const curr = { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime + 1 * 3600000).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "insufficient_data");
  assert.strictEqual(res.suspicious, false);
});

test("Zero time difference returns insufficient_data and suspicious=false", () => {
  const prev = { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime).toISOString() };
  const curr = { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "insufficient_data");
  assert.strictEqual(res.suspicious, false);
});

test("Negative time difference returns insufficient_data and suspicious=false", () => {
  const prev = { latitude: 18.5204, longitude: 73.8567, timestamp: new Date(baseTime + 2 * 3600000).toISOString() };
  const curr = { latitude: 19.0760, longitude: 72.8777, timestamp: new Date(baseTime).toISOString() };

  const res = checkStageTransitionFraud(prev, curr);
  assert.strictEqual(res.status, "insufficient_data");
  assert.strictEqual(res.suspicious, false);
});

console.log("\n📌 Suite 3: Full Batch Lifecycle Check");

test("Full multi-stage batch lifecycle spatiotemporal check", () => {
  const mockBatch = {
    batchId: "BATCH_TEST_001",
    location: { latitude: 18.5204, longitude: 73.8567 },
    createdAt: new Date(baseTime).toISOString(),
    labLocation: { latitude: 18.7557, longitude: 73.4091 },
    updatedAt: new Date(baseTime + 2 * 3600000).toISOString(),
    processLocation: { latitude: 19.0760, longitude: 72.8777 },
    processorData: { processedAt: new Date(baseTime + 6 * 3600000).toISOString() },
  };

  const res = checkBatchSpatiotemporalFraud(mockBatch);
  assert.strictEqual(res.batchId, "BATCH_TEST_001");
  assert.strictEqual(res.suspicious, false);
  assert.strictEqual(res.transitions.length, 2);
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
