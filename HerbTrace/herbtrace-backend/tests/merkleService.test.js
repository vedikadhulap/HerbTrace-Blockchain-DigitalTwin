/**
 * ============================================================
 * merkleService.test.js — Unit + Integration Tests
 * ============================================================
 *
 * Run with: node tests/merkleService.test.js
 * (No testing framework needed — uses pure Node.js assertions)
 *
 * What this tests:
 *   1. Building a 4-leaf Merkle tree
 *   2. Generating proofs for each of the 4 stages
 *   3. Verifying each proof
 *   4. Tree with some EMPTY leaves (partial batch)
 *   5. Root changes when a leaf changes (tamper detection)
 *   6. Invalid proof returns false
 * ============================================================
 */

const assert = require("assert");
const {
  buildMerkleTree,
  generateProof,
  verifyProof,
  buildLeafData,
  toBytes32,
  STAGE,
} = require("../services/merkleService");

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

// ─── Test Data ────────────────────────────────────────────────────────────────

const sampleLeafData = [
  buildLeafData("CREATE", {
    batchId: "BATCH-001",
    herbType: "Tulsi",
    farmLocation: "Pune, Maharashtra",
    latitude: 18.52,
    longitude: 73.85,
  }),
  buildLeafData("TEST", {
    batchId: "BATCH-001",
    testResults: JSON.stringify({ moisture: 12.5, purity: 98.2 }),
    labWallet: "0xLabWallet",
    latitude: 18.5,
    longitude: 73.87,
  }),
  buildLeafData("PROCESS", {
    newBatchId: "BATCH-001",
    parentBatchIds: ["BATCH-000"],
    processorNotes: JSON.stringify({ yield: 85, method: "sun-drying" }),
    latitude: 18.51,
    longitude: 73.84,
  }),
  buildLeafData("TRANSFER", {
    batchId: "BATCH-001",
    newOwner: "0xDistributorWallet",
    transferData: JSON.stringify({ destination: "Mumbai" }),
    latitude: 19.07,
    longitude: 72.87,
  }),
];

// ─── Test Suite ───────────────────────────────────────────────────────────────

console.log("\n🧪 merkleService.test.js — Stage-Wise Merkle Anchoring\n");
console.log("━".repeat(55));

console.log("\n📌 Suite 1: Tree Construction\n");

test("buildMerkleTree returns 3 layers with 4 leaves", () => {
  const { leaves, tree, root } = buildMerkleTree(sampleLeafData);
  assert.strictEqual(leaves.length, 4, "Should have 4 leaves");
  assert.strictEqual(tree.length, 3, "Should have 3 layers");
  assert.strictEqual(tree[0].length, 4, "Layer 0: 4 leaves");
  assert.strictEqual(tree[1].length, 2, "Layer 1: 2 parents");
  assert.strictEqual(tree[2].length, 1, "Layer 2: 1 root");
  assert.ok(root, "Root should exist");
  assert.ok(root.length === 64, "Root should be 64-char hex string");
});

test("Root is deterministic (same input → same root)", () => {
  const { root: root1 } = buildMerkleTree(sampleLeafData);
  const { root: root2 } = buildMerkleTree(sampleLeafData);
  assert.strictEqual(root1, root2, "Same data must produce same root");
});

test("Changing any leaf changes the root (tamper detection)", () => {
  const { root: original } = buildMerkleTree(sampleLeafData);

  const tampered = [...sampleLeafData];
  tampered[1] = "TAMPERED:test data changed"; // modify TEST stage
  const { root: tamperedRoot } = buildMerkleTree(tampered);

  assert.notStrictEqual(original, tamperedRoot, "Root must change when leaf changes");
  console.log(`     Original root: ${original.slice(0, 20)}...`);
  console.log(`     Tampered root: ${tamperedRoot.slice(0, 20)}...`);
});

test("EMPTY leaves produce consistent placeholder hashes", () => {
  const partialData = [sampleLeafData[0], null, null, null]; // only CREATE stage done
  const { leaves, root } = buildMerkleTree(partialData);
  assert.ok(leaves[0] !== leaves[1], "CREATE leaf ≠ EMPTY leaf");
  assert.strictEqual(leaves[1], leaves[2], "Two EMPTY leaves hash identically");
  assert.ok(root, "Partial tree still has a valid root");
});

console.log("\n📌 Suite 2: Proof Generation\n");

test("generateProof returns 2 siblings for each stage", () => {
  for (let i = 0; i < 4; i++) {
    const result = generateProof(sampleLeafData, i);
    assert.strictEqual(result.proof.length, 2, `Stage ${i} proof should have 2 siblings`);
    assert.ok(result.leaf, `Stage ${i} leaf should exist`);
    assert.ok(result.root, `Stage ${i} root should exist`);
    assert.strictEqual(result.stageIndex, i, "stageIndex should match");
    assert.strictEqual(result.stageName, ["CREATE","TEST","PROCESS","TRANSFER"][i]);
  }
});

test("All 4 proofs reference the same root", () => {
  const roots = [0,1,2,3].map((i) => generateProof(sampleLeafData, i).root);
  assert.ok(roots.every((r) => r === roots[0]), "All proofs must share the same root");
});

console.log("\n📌 Suite 3: Proof Verification\n");

test("verifyProof returns true for all 4 valid proofs", () => {
  for (let i = 0; i < 4; i++) {
    const { proof, root, leaf, stageIndex } = generateProof(sampleLeafData, i);
    const isValid = verifyProof(root, leaf, proof, stageIndex);
    assert.strictEqual(isValid, true, `Stage ${i} (${["CREATE","TEST","PROCESS","TRANSFER"][i]}) proof should verify`);
  }
  console.log("     → All 4 stage proofs verified successfully");
});

test("verifyProof returns false for tampered leaf", () => {
  const { proof, root, stageIndex } = generateProof(sampleLeafData, 1); // TEST stage
  const fakeleaf = "a".repeat(64); // wrong leaf hash
  const isValid = verifyProof(root, fakeleaf, proof, stageIndex);
  assert.strictEqual(isValid, false, "Tampered leaf must fail verification");
});

test("verifyProof returns false for wrong proof", () => {
  const { proof, root, leaf, stageIndex } = generateProof(sampleLeafData, 0);
  const brokenProof = [proof[0], "b".repeat(64)]; // corrupt sibling[1]
  const isValid = verifyProof(root, leaf, brokenProof, stageIndex);
  assert.strictEqual(isValid, false, "Wrong proof sibling must fail verification");
});

test("verifyProof returns false for wrong root", () => {
  const { proof, leaf, stageIndex } = generateProof(sampleLeafData, 2);
  const wrongRoot = "c".repeat(64);
  const isValid = verifyProof(wrongRoot, leaf, proof, stageIndex);
  assert.strictEqual(isValid, false, "Wrong root must fail verification");
});

console.log("\n📌 Suite 4: Utility Functions\n");

test("toBytes32 prepends 0x correctly", () => {
  const hex = "a".repeat(64);
  assert.strictEqual(toBytes32(hex), `0x${hex}`);
  assert.strictEqual(toBytes32(`0x${hex}`), `0x${hex}`, "Should not double-prepend");
});

test("buildLeafData produces deterministic sorted-key JSON", () => {
  const data1 = buildLeafData("CREATE", { batchId: "X", herbType: "Tulsi", lat: 18 });
  const data2 = buildLeafData("CREATE", { herbType: "Tulsi", lat: 18, batchId: "X" }); // different key order
  assert.strictEqual(data1, data2, "Key order must not matter (sorted internally)");
});

test("buildMerkleTree throws for wrong number of leaves", () => {
  assert.throws(() => buildMerkleTree([null, null, null]), /exactly 4/);
  assert.throws(() => buildMerkleTree([null, null, null, null, null]), /exactly 4/);
});

console.log("\n📌 Suite 5: End-to-End Scenario\n");

test("Full batch lifecycle: create → test → process → transfer → verify all", () => {
  // Simulate a batch going through all 4 stages
  // Each stage fills in its leaf; the root stabilises at the end

  const stages = [];

  // Stage 0: Create
  stages.push(buildLeafData("CREATE", { batchId: "E2E-001", herbType: "Ashwagandha" }));
  const root0 = buildMerkleTree([...stages, null, null, null]).root;

  // Stage 1: Test
  stages.push(buildLeafData("TEST", { batchId: "E2E-001", purity: 99.1 }));
  const root1 = buildMerkleTree([...stages, null, null]).root;

  // Stage 2: Process
  stages.push(buildLeafData("PROCESS", { newBatchId: "E2E-001", yield: 90 }));
  const root2 = buildMerkleTree([...stages, null]).root;

  // Stage 3: Transfer (final — root is now stable)
  stages.push(buildLeafData("TRANSFER", { batchId: "E2E-001", destination: "Delhi" }));
  const finalRoot = buildMerkleTree(stages).root;

  // Root should change at each stage
  assert.notStrictEqual(root0, root1, "Root changes after TEST stage");
  assert.notStrictEqual(root1, root2, "Root changes after PROCESS stage");
  assert.notStrictEqual(root2, finalRoot, "Root changes after TRANSFER stage");

  // Verify all 4 stage proofs against the final root
  for (let i = 0; i < 4; i++) {
    const { proof, leaf } = generateProof(stages, i);
    const valid = verifyProof(finalRoot, leaf, proof, i);
    assert.ok(valid, `Stage ${i} proof must verify against final root`);
  }

  console.log(`     Final Merkle root: ${finalRoot.slice(0, 32)}...`);
  console.log(`     All 4 stage proofs verified against the final anchored root ✅`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\n" + "━".repeat(55));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 All tests passed! Merkle service is working correctly.\n");
}
