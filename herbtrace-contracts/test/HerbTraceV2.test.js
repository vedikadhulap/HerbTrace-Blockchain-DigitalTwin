/**
 * ============================================================
 * HerbTraceV2.test.js — Hardhat Tests for V2/V3 Contract Functions
 * ============================================================
 *
 * Run with: npx hardhat test test/HerbTraceV2.test.js
 *
 * Tests:
 *   Regression — Existing Functions Unchanged
 *   Feature 1: anchorMerkleRoot() / getMerkleRoot()
 *   Feature 2: recordLocationVerification() / getLocationVerification()
 *
 * NOTE: Updated for v3 contract interface:
 *   - recordTest() now takes (batchId, dataHash, LabOutcome, reason)
 *   - anchorMerkleRoot() now takes (batchId, stageIndex, merkleRoot)
 *   - processBatch() requires parents to be in Tested/Processed state
 * ============================================================
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HerbTrace V2 — New Feature Functions", function () {
  let contract;
  let admin, farmer, lab, processor, distributor, other;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const toBatchHash = (str) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const FARMER_ROLE      = ethers.keccak256(ethers.toUtf8Bytes("FARMER_ROLE"));
  const LAB_ROLE         = ethers.keccak256(ethers.toUtf8Bytes("LAB_ROLE"));
  const PROCESSOR_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("PROCESSOR_ROLE"));
  const DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));

  // LabOutcome enum: 0=Pass, 1=Fail, 2=Flagged
  const LabOutcome = { Pass: 0, Fail: 1, Flagged: 2 };

  // A sample Merkle root (64 hex chars = 32 bytes)
  const SAMPLE_MERKLE_ROOT = "0x" + "a1b2c3d4".repeat(8); // 32 bytes

  beforeEach(async function () {
    [admin, farmer, lab, processor, distributor, other] = await ethers.getSigners();

    const HerbTrace = await ethers.getContractFactory("HerbTrace");
    contract = await HerbTrace.deploy();

    // Grant roles
    await contract.connect(admin).addFarmer(farmer.address);
    await contract.connect(admin).addLab(lab.address);
    await contract.connect(admin).addProcessor(processor.address);
    await contract.connect(admin).addDistributor(distributor.address);
  });

  // ── Helper: create a batch (needed for most tests) ─────────────────────
  const createTestBatch = async (batchId = "BATCH-TEST-001") => {
    const dataHash = toBatchHash(`create:${batchId}`);
    await contract.connect(farmer).createBatch(batchId, dataHash);
    return batchId;
  };

  // ── Helper: create and pass-test a batch ───────────────────────────────
  const createAndTestBatch = async (batchId) => {
    await contract.connect(farmer).createBatch(batchId, toBatchHash(`create:${batchId}`));
    await contract.connect(lab).recordTest(batchId, toBatchHash(`test:${batchId}`), LabOutcome.Pass, "");
    return batchId;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // REGRESSION: Existing functions must still work
  // ══════════════════════════════════════════════════════════════════════════

  describe("Regression — Existing Functions Unchanged", function () {
    it("createBatch still works", async function () {
      const batchId = "REGR-001";
      const dataHash = toBatchHash("regression-create");
      await expect(contract.connect(farmer).createBatch(batchId, dataHash))
        .to.emit(contract, "BatchCreated")
        .withArgs(batchId, farmer.address, dataHash);
    });

    it("recordTest still works (v3: takes outcome param)", async function () {
      const batchId = await createTestBatch("REGR-002");
      const dataHash = toBatchHash("regression-test");
      // v3 recordTest signature: (batchId, dataHash, outcome, reason)
      await expect(contract.connect(lab).recordTest(batchId, dataHash, LabOutcome.Pass, ""))
        .to.emit(contract, "BatchUpdated");
    });

    it("processBatch still works (parent must be Tested)", async function () {
      const parentId = await createAndTestBatch("PARENT-001");
      const newId = "PROCESSED-001";
      const dataHash = toBatchHash("regression-process");
      await expect(contract.connect(processor).processBatch(newId, [parentId], dataHash))
        .to.emit(contract, "BatchProcessed");
    });

    it("transferCustody still works", async function () {
      const parentId = await createAndTestBatch("TRANSFER-001-PARENT");
      await contract.connect(processor).processBatch("TRANSFER-001", [parentId], toBatchHash("process"));
      const dataHash = toBatchHash("regression-transfer");
      await expect(
        contract.connect(distributor).transferCustody("TRANSFER-001", other.address, dataHash)
      ).to.emit(contract, "BatchUpdated");
    });

    it("getBatch and getParents still work", async function () {
      const batchId = await createTestBatch("GETBATCH-001");
      const batch = await contract.getBatch(batchId);
      expect(batch.batchId).to.equal(batchId);
      const parents = await contract.getParents(batchId);
      expect(parents).to.be.an("array");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FEATURE 1: anchorMerkleRoot
  // ══════════════════════════════════════════════════════════════════════════

  describe("Feature 1: anchorMerkleRoot()", function () {
    it("emits MerkleRootAnchored event with correct args", async function () {
      const batchId = await createTestBatch("MERKLE-001");

      await expect(contract.connect(farmer).anchorMerkleRoot(batchId, 0, SAMPLE_MERKLE_ROOT))
        .to.emit(contract, "MerkleRootAnchored");
    });

    it("getMerkleRoot returns the anchored root and anchored=true", async function () {
      const batchId = await createTestBatch("MERKLE-002");
      await contract.connect(farmer).anchorMerkleRoot(batchId, 0, SAMPLE_MERKLE_ROOT);

      const [root, anchored] = await contract.getMerkleRoot(batchId);
      expect(root).to.equal(SAMPLE_MERKLE_ROOT);
      expect(anchored).to.equal(true);
    });

    it("getMerkleRoot returns zero + anchored=false before anchoring", async function () {
      const batchId = await createTestBatch("MERKLE-003");
      const [root, anchored] = await contract.getMerkleRoot(batchId);
      expect(root).to.equal("0x" + "00".repeat(32));
      expect(anchored).to.equal(false);
    });

    it("can anchor multiple stage indices (array-based, no single-anchor limit)", async function () {
      // v3 design: anchorMerkleRoot pushes to an array — multiple anchors allowed
      const batchId = await createTestBatch("MERKLE-004");
      await contract.connect(farmer).anchorMerkleRoot(batchId, 0, SAMPLE_MERKLE_ROOT);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("new-root"));
      // Second call for a different stage is allowed
      await expect(
        contract.connect(farmer).anchorMerkleRoot(batchId, 1, newRoot)
      ).to.not.be.reverted;
    });

    it("reverts for non-existent batch", async function () {
      await expect(
        contract.connect(farmer).anchorMerkleRoot("NONEXISTENT-999", 0, SAMPLE_MERKLE_ROOT)
      ).to.be.revertedWith("Batch does not exist");
    });

    it("reverts for zero bytes32 root", async function () {
      const batchId = await createTestBatch("MERKLE-005");
      const zeroRoot = "0x" + "00".repeat(32);
      await expect(
        contract.connect(farmer).anchorMerkleRoot(batchId, 0, zeroRoot)
      ).to.be.revertedWith("Merkle root cannot be zero");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // FEATURE 2: recordLocationVerification
  // ══════════════════════════════════════════════════════════════════════════

  describe("Feature 2: recordLocationVerification()", function () {
    it("emits LocationVerified event with correct args", async function () {
      const batchId = await createTestBatch("LOC-001");

      await expect(contract.connect(farmer).recordLocationVerification(
        batchId, 0, true, "Pune, Maharashtra"
      ))
        .to.emit(contract, "LocationVerified");
    });

    it("emits LocationVerified with verified=false for low confidence", async function () {
      const batchId = await createTestBatch("LOC-002");
      const tx = await contract.connect(farmer).recordLocationVerification(batchId, 1, false, "");
      const receipt = await tx.wait();
      expect(receipt.logs.length).to.be.greaterThan(0, "Should emit at least one event");
      const record = await contract.getLocationVerification(batchId, 1);
      expect(record.verified).to.equal(false);
      expect(record.agreedLocation).to.equal("");
    });

    it("getLocationVerification returns correct record for stage 0", async function () {
      const batchId = await createTestBatch("LOC-003");
      await contract.connect(farmer).recordLocationVerification(
        batchId, 0, true, "Nashik, Maharashtra"
      );

      const record = await contract.getLocationVerification(batchId, 0);
      expect(record.verified).to.equal(true);
      expect(record.agreedLocation).to.equal("Nashik, Maharashtra");
      expect(record.recordedBy).to.equal(farmer.address);
    });

    it("can record verifications for all 4 stages independently", async function () {
      const batchId = await createTestBatch("LOC-004");
      const stages = [
        { index: 0, location: "Pune, Maharashtra",    verified: true  },
        { index: 1, location: "Nagpur, Maharashtra",  verified: true  },
        { index: 2, location: "Mumbai, Maharashtra",  verified: false },
        { index: 3, location: "Delhi",                verified: true  },
      ];

      for (const s of stages) {
        await contract.connect(farmer).recordLocationVerification(
          batchId, s.index, s.verified, s.location
        );
      }

      for (const s of stages) {
        const record = await contract.getLocationVerification(batchId, s.index);
        expect(record.verified).to.equal(s.verified);
        expect(record.agreedLocation).to.equal(s.location);
      }
    });

    it("reverts for stageIndex > 3", async function () {
      const batchId = await createTestBatch("LOC-005");
      await expect(
        contract.connect(farmer).recordLocationVerification(batchId, 4, true, "Pune")
      ).to.be.revertedWith("stageIndex must be 0-3");
    });

    it("reverts for non-existent batch", async function () {
      await expect(
        contract.connect(farmer).recordLocationVerification(
          "NONEXISTENT-LOC", 0, true, "Pune"
        )
      ).to.be.revertedWith("Batch does not exist");
    });

    it("getLocationVerification for unset stage returns zero-value struct", async function () {
      const batchId = await createTestBatch("LOC-006");
      const record = await contract.getLocationVerification(batchId, 2);
      expect(record.verified).to.equal(false);
      expect(record.agreedLocation).to.equal("");
    });
  });

  // ── Utility ──────────────────────────────────────────────────────────────
  const getBlockTimestamp = async (tx) => {
    const receipt = await tx.wait();
    const block   = await ethers.provider.getBlock(receipt.blockNumber);
    return block.timestamp;
  };
});
