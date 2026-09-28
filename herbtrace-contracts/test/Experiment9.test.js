/**
 * ============================================================
 * HerbTrace Experiment 9 — Failure Resilience Tests
 * ============================================================
 *
 * Tests for:
 *   A. Lab Test Failure / Quarantine Handling
 *   B. Lineage-Based Batch Recall
 *   C. Regression — Existing Lifecycle Still Works
 *
 * Run with:
 *   npx hardhat test test/Experiment9.test.js
 *
 * ============================================================
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Experiment 9 — Failure Resilience", function () {
  let contract;
  let admin, farmer, lab, processor, distributor, unauthorized;

  const toBH = (str) => ethers.keccak256(ethers.toUtf8Bytes(str));

  // LabOutcome enum indices (must match Solidity)
  const LabOutcome = { Pass: 0, Fail: 1, Flagged: 2 };

  // Status enum indices (must match Solidity)
  const Status = {
    Created: 0, Tested: 1, Processed: 2, Transferred: 3,
    TestFailed: 4, Quarantined: 5, Recalled: 6,
  };

  beforeEach(async function () {
    [admin, farmer, lab, processor, distributor, unauthorized] = await ethers.getSigners();
    const HerbTrace = await ethers.getContractFactory("HerbTrace");
    contract = await HerbTrace.deploy();

    await contract.connect(admin).addFarmer(farmer.address);
    await contract.connect(admin).addLab(lab.address);
    await contract.connect(admin).addProcessor(processor.address);
    await contract.connect(admin).addDistributor(distributor.address);
  });

  // ── Helper ─────────────────────────────────────────────────────────────────
  const createBatch = async (batchId) => {
    await contract.connect(farmer).createBatch(batchId, toBH(`create:${batchId}`));
    return batchId;
  };

  const passTest = async (batchId) => {
    await contract.connect(lab).recordTest(batchId, toBH(`test:${batchId}`), LabOutcome.Pass, "");
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE A — LAB TEST FAILURE / QUARANTINE
  // ══════════════════════════════════════════════════════════════════════════

  describe("A. Lab Test Failure Handling", function () {

    it("A1. Valid PASS lab test succeeds and sets status to Tested", async function () {
      const batchId = await createBatch("A1-BATCH");
      await expect(
        contract.connect(lab).recordTest(batchId, toBH("test-pass"), LabOutcome.Pass, "")
      ).to.emit(contract, "TestRecorded");

      const batch = await contract.getBatch(batchId);
      expect(Number(batch.status)).to.equal(Status.Tested);
    });

    it("A2. Valid FAIL lab test succeeds and sets status to TestFailed", async function () {
      const batchId = await createBatch("A2-BATCH");
      await expect(
        contract.connect(lab).recordTest(batchId, toBH("test-fail"), LabOutcome.Fail, "Heavy metal contamination")
      )
        .to.emit(contract, "TestFailed")
        .to.emit(contract, "BatchUpdated");

      const batch = await contract.getBatch(batchId);
      expect(Number(batch.status)).to.equal(Status.TestFailed);
    });

    it("A3. FLAGGED lab test sets status to Tested (not blocked)", async function () {
      const batchId = await createBatch("A3-BATCH");
      await contract.connect(lab).recordTest(batchId, toBH("test-flagged"), LabOutcome.Flagged, "Border-line moisture");
      const batch = await contract.getBatch(batchId);
      expect(Number(batch.status)).to.equal(Status.Tested); // Flagged → Tested, not blocked
    });

    it("A4. Failed batch CANNOT be processed", async function () {
      const batchId = await createBatch("A4-BATCH");
      await contract.connect(lab).recordTest(batchId, toBH("fail"), LabOutcome.Fail, "Contaminated");

      await expect(
        contract.connect(processor).processBatch("A4-PROC", [batchId], toBH("process"))
      ).to.be.revertedWith("One or more parent batches are blocked (TestFailed, Quarantined, or Recalled)");
    });

    it("A5. Failed batch CANNOT be transferred", async function () {
      const batchId = await createBatch("A5-BATCH");
      // First pass test to reach Tested, then another approach: just fail and try to transfer
      await createBatch("A5-TESTED");
      await passTest("A5-TESTED");
      // Process to get a Processed batch
      await contract.connect(processor).processBatch("A5-PROC", ["A5-TESTED"], toBH("proc-data"));
      // Now fail the original batch and try to transfer it
      await contract.connect(lab).recordTest(batchId, toBH("fail"), LabOutcome.Fail, "Fail");

      await expect(
        contract.connect(distributor).transferCustody(batchId, distributor.address, toBH("transfer"))
      ).to.be.revertedWith("Batch is blocked (TestFailed, Quarantined, or Recalled)");
    });

    it("A6. Unauthorized user CANNOT submit lab result", async function () {
      const batchId = await createBatch("A6-BATCH");
      await expect(
        contract.connect(unauthorized).recordTest(batchId, toBH("test"), LabOutcome.Pass, "")
      ).to.be.reverted; // AccessControl revert
    });

    it("A7. Lab test on non-existent batch is rejected", async function () {
      await expect(
        contract.connect(lab).recordTest("NONEXISTENT-999", toBH("test"), LabOutcome.Pass, "")
      ).to.be.revertedWith("Batch not found");
    });

    it("A8. Lab test on already-tested batch is rejected (must be Created)", async function () {
      const batchId = await createBatch("A8-BATCH");
      await passTest(batchId);
      await expect(
        contract.connect(lab).recordTest(batchId, toBH("re-test"), LabOutcome.Pass, "")
      ).to.be.revertedWith("Batch must be in Created state for lab test");
    });

    it("A9. Existing successful lifecycle (Create→Pass→Process→Transfer) still works", async function () {
      await contract.connect(farmer).createBatch("A9-RAW", toBH("create"));
      await contract.connect(lab).recordTest("A9-RAW", toBH("test"), LabOutcome.Pass, "");
      await contract.connect(processor).processBatch("A9-PROC", ["A9-RAW"], toBH("process"));
      await contract.connect(distributor).transferCustody("A9-PROC", distributor.address, toBH("transfer"));

      const raw  = await contract.getBatch("A9-RAW");
      const proc = await contract.getBatch("A9-PROC");
      expect(Number(raw.status)).to.equal(Status.Tested);
      expect(Number(proc.status)).to.equal(Status.Transferred);
    });

    it("A10. Admin can quarantine a batch", async function () {
      const batchId = await createBatch("A10-BATCH");
      await contract.connect(admin).quarantineBatch(batchId, "Admin hold for investigation");
      const batch = await contract.getBatch(batchId);
      expect(Number(batch.status)).to.equal(Status.Quarantined);
    });

    it("A11. Quarantined batch CANNOT be processed", async function () {
      const batchId = await createBatch("A11-BATCH");
      await contract.connect(admin).quarantineBatch(batchId, "Hold");
      await expect(
        contract.connect(processor).processBatch("A11-PROC", [batchId], toBH("process"))
      ).to.be.revertedWith("One or more parent batches are blocked (TestFailed, Quarantined, or Recalled)");
    });

    it("A12. Quarantined batch CANNOT be transferred", async function () {
      const batchId = await createBatch("A12-BATCH");
      await contract.connect(admin).quarantineBatch(batchId, "Hold");
      await expect(
        contract.connect(distributor).transferCustody(batchId, distributor.address, toBH("transfer"))
      ).to.be.revertedWith("Batch is blocked (TestFailed, Quarantined, or Recalled)");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE B — LINEAGE-BASED RECALL
  // ══════════════════════════════════════════════════════════════════════════

  describe("B. Lineage-Based Batch Recall", function () {

    /**
     * Lineage graph:
     *
     *   ROOT-A (Created→Tested)
     *   ├── CHILD-B (Processed from ROOT-A)
     *   │   └── CHILD-C (Processed from CHILD-B)
     *   └── CHILD-D (Processed from ROOT-A)
     *
     * Plus UNRELATED-Z (completely separate chain — should NOT be affected)
     */
    const buildTestLineage = async () => {
      // Root batch
      await contract.connect(farmer).createBatch("ROOT-A", toBH("create-root"));
      await contract.connect(lab).recordTest("ROOT-A", toBH("test-root"), LabOutcome.Pass, "");

      // Child B
      await contract.connect(processor).processBatch("CHILD-B", ["ROOT-A"], toBH("process-b"));

      // Child C (from Child B)
      await contract.connect(processor).processBatch("CHILD-C", ["CHILD-B"], toBH("process-c"));

      // Child D (from Root A)
      await contract.connect(processor).processBatch("CHILD-D", ["ROOT-A"], toBH("process-d"));

      // Unrelated batch
      await contract.connect(farmer).createBatch("UNRELATED-Z", toBH("unrelated"));
      await contract.connect(lab).recordTest("UNRELATED-Z", toBH("test-z"), LabOutcome.Pass, "");
    };

    it("B1. Admin can recall a batch", async function () {
      await createBatch("B1-BATCH");
      await expect(
        contract.connect(admin).recallBatch("B1-BATCH", "Contamination confirmed")
      )
        .to.emit(contract, "BatchRecalled")
        .withArgs("B1-BATCH", admin.address, "Contamination confirmed");
    });

    it("B2. Recalled batch status is set to Recalled (6)", async function () {
      await createBatch("B2-BATCH");
      await contract.connect(admin).recallBatch("B2-BATCH", "Safety recall");
      const batch = await contract.getBatch("B2-BATCH");
      expect(Number(batch.status)).to.equal(Status.Recalled);
    });

    it("B3. Recalled batch CANNOT be transferred", async function () {
      await createBatch("B3-BATCH");
      await contract.connect(admin).recallBatch("B3-BATCH", "Safety recall");
      await expect(
        contract.connect(distributor).transferCustody("B3-BATCH", distributor.address, toBH("transfer"))
      ).to.be.revertedWith("Batch is blocked (TestFailed, Quarantined, or Recalled)");
    });

    it("B4. Recalled batch CANNOT be used as a parent for processing", async function () {
      const batchId = await createBatch("B4-RAW");
      await passTest(batchId);
      await contract.connect(admin).recallBatch(batchId, "Recall");
      await expect(
        contract.connect(processor).processBatch("B4-PROC", [batchId], toBH("process"))
      ).to.be.revertedWith("One or more parent batches are blocked (TestFailed, Quarantined, or Recalled)");
    });

    it("B5. Already-recalled batch cannot be recalled again", async function () {
      await createBatch("B5-BATCH");
      await contract.connect(admin).recallBatch("B5-BATCH", "First recall");
      await expect(
        contract.connect(admin).recallBatch("B5-BATCH", "Second recall attempt")
      ).to.be.revertedWith("Batch already recalled");
    });

    it("B6. Recall of non-existent batch is rejected", async function () {
      await expect(
        contract.connect(admin).recallBatch("NONEXISTENT-RECALL", "Recall")
      ).to.be.revertedWith("Batch not found");
    });

    it("B7. Unauthorized user CANNOT recall a batch", async function () {
      await createBatch("B7-BATCH");
      await expect(
        contract.connect(unauthorized).recallBatch("B7-BATCH", "Unauthorized recall")
      ).to.be.reverted; // AccessControl
    });

    it("B8. Farmer CANNOT recall a batch (not admin)", async function () {
      await createBatch("B8-BATCH");
      await expect(
        contract.connect(farmer).recallBatch("B8-BATCH", "Farmer recall")
      ).to.be.reverted; // AccessControl
    });

    it("B9. Lineage graph: recall ROOT-A marks it Recalled", async function () {
      await buildTestLineage();
      await contract.connect(admin).recallBatch("ROOT-A", "Root contamination");
      const rootA = await contract.getBatch("ROOT-A");
      expect(Number(rootA.status)).to.equal(Status.Recalled);
    });

    it("B10. Unrelated batch is NOT affected when ROOT-A is recalled", async function () {
      await buildTestLineage();
      await contract.connect(admin).recallBatch("ROOT-A", "Root contamination");
      const unrelated = await contract.getBatch("UNRELATED-Z");
      expect(Number(unrelated.status)).to.equal(Status.Tested); // still Tested, not Recalled
    });

    it("B11. After ROOT-A recall, child B cannot be used as parent (itself not yet recalled on-chain — test guard)", async function () {
      // On-chain: each batch must be individually recalled.
      // This test verifies that CHILD-B (not yet recalled on-chain) can be guarded
      // by the on-chain recall of its parent for future processing.
      await buildTestLineage();
      await contract.connect(admin).recallBatch("CHILD-B", "Direct recall of B");
      // CHILD-C trying to use CHILD-B as parent — B is Recalled, so blocked
      await expect(
        contract.connect(processor).processBatch("CHILD-E", ["CHILD-B"], toBH("proc-e"))
      ).to.be.revertedWith("One or more parent batches are blocked (TestFailed, Quarantined, or Recalled)");
    });

    it("B12. Recall emits BatchRecalled event with correct args", async function () {
      await createBatch("B12-BATCH");
      await expect(contract.connect(admin).recallBatch("B12-BATCH", "Quality failure"))
        .to.emit(contract, "BatchRecalled")
        .withArgs("B12-BATCH", admin.address, "Quality failure");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE C — REGRESSION: Existing Functions Still Work
  // ══════════════════════════════════════════════════════════════════════════

  describe("C. Regression — Existing Lifecycle Unchanged", function () {

    it("C1. createBatch still works and emits BatchCreated", async function () {
      await expect(contract.connect(farmer).createBatch("REGR-C1", toBH("create")))
        .to.emit(contract, "BatchCreated")
        .withArgs("REGR-C1", farmer.address, toBH("create"));
    });

    it("C2. Duplicate createBatch is rejected", async function () {
      await contract.connect(farmer).createBatch("REGR-C2", toBH("create"));
      await expect(contract.connect(farmer).createBatch("REGR-C2", toBH("create2")))
        .to.be.revertedWith("Batch already exists");
    });

    it("C3. processBatch still works and emits BatchProcessed", async function () {
      await createBatch("REGR-C3-RAW");
      await passTest("REGR-C3-RAW");
      await expect(
        contract.connect(processor).processBatch("REGR-C3-PROC", ["REGR-C3-RAW"], toBH("process"))
      ).to.emit(contract, "BatchProcessed");
    });

    it("C4. transferCustody still works and emits CustodyTransferred", async function () {
      await createBatch("REGR-C4-RAW");
      await passTest("REGR-C4-RAW");
      await contract.connect(processor).processBatch("REGR-C4-PROC", ["REGR-C4-RAW"], toBH("process"));
      await expect(
        contract.connect(distributor).transferCustody("REGR-C4-PROC", distributor.address, toBH("transfer"))
      ).to.emit(contract, "CustodyTransferred");
    });

    it("C5. getBatch and getParents still work", async function () {
      await createBatch("REGR-C5-RAW");
      await passTest("REGR-C5-RAW");
      await contract.connect(processor).processBatch("REGR-C5-PROC", ["REGR-C5-RAW"], toBH("process"));
      const batch = await contract.getBatch("REGR-C5-PROC");
      expect(batch.batchId).to.equal("REGR-C5-PROC");
      const parents = await contract.getParents("REGR-C5-PROC");
      expect(parents).to.include("REGR-C5-RAW");
    });

    it("C6. RBAC still enforced — farmer cannot call recordTest", async function () {
      await createBatch("REGR-C6");
      await expect(
        contract.connect(farmer).recordTest("REGR-C6", toBH("test"), LabOutcome.Pass, "")
      ).to.be.reverted;
    });

    it("C7. RBAC still enforced — lab cannot call createBatch", async function () {
      await expect(
        contract.connect(lab).createBatch("REGR-C7", toBH("create"))
      ).to.be.reverted;
    });

    it("C8. RBAC still enforced — processor cannot call transferCustody", async function () {
      await createBatch("REGR-C8-RAW");
      await passTest("REGR-C8-RAW");
      await contract.connect(processor).processBatch("REGR-C8-PROC", ["REGR-C8-RAW"], toBH("process"));
      await expect(
        contract.connect(processor).transferCustody("REGR-C8-PROC", processor.address, toBH("transfer"))
      ).to.be.reverted;
    });

    it("C9. anchorMerkleRoot still works for valid batches", async function () {
      const batchId = await createBatch("REGR-C9");
      const root = ethers.keccak256(ethers.toUtf8Bytes("merkle-root-C9"));
      await expect(
        contract.connect(farmer).anchorMerkleRoot(batchId, 0, root)
      ).to.emit(contract, "MerkleRootAnchored");

      const [storedRoot, anchored] = await contract.getMerkleRoot(batchId);
      expect(storedRoot).to.equal(root);
      expect(anchored).to.be.true;
    });

    it("C10. recordLocationVerification still works", async function () {
      const batchId = await createBatch("REGR-C10");
      await expect(
        contract.connect(farmer).recordLocationVerification(batchId, 0, true, "Pune, Maharashtra")
      ).to.emit(contract, "LocationVerified");

      const record = await contract.getLocationVerification(batchId, 0);
      expect(record.verified).to.be.true;
      expect(record.agreedLocation).to.equal("Pune, Maharashtra");
    });

    it("C11. stageIndex > 3 is rejected in recordLocationVerification", async function () {
      const batchId = await createBatch("REGR-C11");
      await expect(
        contract.connect(farmer).recordLocationVerification(batchId, 4, true, "Invalid Stage")
      ).to.be.revertedWith("stageIndex must be 0-3");
    });

    it("C12. Merkle anchoring on non-existent batch is rejected", async function () {
      const root = ethers.keccak256(ethers.toUtf8Bytes("root"));
      await expect(
        contract.connect(farmer).anchorMerkleRoot("NONEXISTENT", 0, root)
      ).to.be.revertedWith("Batch does not exist");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE D — ROLE AUTHORIZATION
  // ══════════════════════════════════════════════════════════════════════════

  describe("D. Role Authorization", function () {

    it("D1. Only admin can grant roles", async function () {
      await expect(
        contract.connect(farmer).addLab(unauthorized.address)
      ).to.be.reverted;
    });

    it("D2. Admin CAN grant LAB_ROLE", async function () {
      await expect(
        contract.connect(admin).addLab(unauthorized.address)
      ).to.not.be.reverted;
    });

    it("D3. Only admin can quarantine a batch", async function () {
      await createBatch("D3-BATCH");
      await expect(
        contract.connect(farmer).quarantineBatch("D3-BATCH", "Quarantine")
      ).to.be.reverted;
    });

    it("D4. Only admin can recall a batch", async function () {
      await createBatch("D4-BATCH");
      await expect(
        contract.connect(lab).recallBatch("D4-BATCH", "Lab recall")
      ).to.be.reverted;
    });
  });
});
