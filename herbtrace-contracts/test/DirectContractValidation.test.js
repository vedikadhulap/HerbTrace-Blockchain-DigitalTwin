const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TEST F — Direct Smart Contract Validation (HerbTrace.sol)", function () {
  let contract;
  let admin, farmer, lab, processor;

  const toBatchHash = (str) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const LabOutcome = { Pass: 0, Fail: 1, Flagged: 2 };

  beforeEach(async function () {
    [admin, farmer, lab, processor] = await ethers.getSigners();
    const HerbTrace = await ethers.getContractFactory("HerbTrace");
    contract = await HerbTrace.deploy();

    await contract.connect(admin).addFarmer(farmer.address);
    await contract.connect(admin).addLab(lab.address);
    await contract.connect(admin).addProcessor(processor.address);
  });

  it("A. TEST_FAILED parent → processBatch() MUST revert", async function () {
    const parentId = "DIRECT-FAIL-001";
    await contract.connect(farmer).createBatch(parentId, toBatchHash("create"));
    await contract.connect(lab).recordTest(parentId, toBatchHash("test"), LabOutcome.Fail, "Pesticides detected");

    const batchData = await contract.batches(parentId);
    expect(batchData.status).to.equal(4); // TestFailed (4)

    let reverted = false;
    let revertReason = "";
    try {
      await contract.connect(processor).processBatch("CHILD-FAIL-001", [parentId], toBatchHash("process"));
    } catch (err) {
      reverted = true;
      revertReason = err.message;
    }

    expect(reverted).to.be.true;
    expect(revertReason).to.include("One or more parent batches are blocked");
    console.log("  ✅ Direct Contract Test A (TEST_FAILED): Reverted = true | Reason snippet: parent batches are blocked");
  });

  it("B. QUARANTINED parent → processBatch() MUST revert", async function () {
    const parentId = "DIRECT-QUARANTINE-001";
    await contract.connect(farmer).createBatch(parentId, toBatchHash("create"));
    await contract.connect(lab).recordTest(parentId, toBatchHash("test"), LabOutcome.Pass, "");
    await contract.connect(admin).quarantineBatch(parentId, "Administrative hold");

    const batchData = await contract.batches(parentId);
    expect(batchData.status).to.equal(5); // Quarantined (5)

    let reverted = false;
    let revertReason = "";
    try {
      await contract.connect(processor).processBatch("CHILD-QUARANTINE-001", [parentId], toBatchHash("process"));
    } catch (err) {
      reverted = true;
      revertReason = err.message;
    }

    expect(reverted).to.be.true;
    expect(revertReason).to.include("One or more parent batches are blocked");
    console.log("  ✅ Direct Contract Test B (QUARANTINED): Reverted = true | Reason snippet: parent batches are blocked");
  });

  it("C. RECALLED parent → processBatch() MUST revert", async function () {
    const parentId = "DIRECT-RECALL-001";
    await contract.connect(farmer).createBatch(parentId, toBatchHash("create"));
    await contract.connect(lab).recordTest(parentId, toBatchHash("test"), LabOutcome.Pass, "");
    await contract.connect(admin).recallBatch(parentId, "Contamination recall");

    const batchData = await contract.batches(parentId);
    expect(batchData.status).to.equal(6); // Recalled (6)

    let reverted = false;
    let revertReason = "";
    try {
      await contract.connect(processor).processBatch("CHILD-RECALL-001", [parentId], toBatchHash("process"));
    } catch (err) {
      reverted = true;
      revertReason = err.message;
    }

    expect(reverted).to.be.true;
    expect(revertReason).to.include("One or more parent batches are blocked");
    console.log("  ✅ Direct Contract Test C (RECALLED): Reverted = true | Reason snippet: parent batches are blocked");
  });

  it("D. TESTED parent → processBatch() MUST succeed", async function () {
    const parentId = "DIRECT-PASS-001";
    const childId = "CHILD-PASS-001";
    await contract.connect(farmer).createBatch(parentId, toBatchHash("create"));
    await contract.connect(lab).recordTest(parentId, toBatchHash("test"), LabOutcome.Pass, "");

    const tx = await contract.connect(processor).processBatch(childId, [parentId], toBatchHash("process"));
    const receipt = await tx.wait();

    const childData = await contract.batches(childId);
    expect(childData.status).to.equal(2); // Processed (2)
    expect(receipt.status).to.equal(1); // tx succeeded
    console.log("  ✅ Direct Contract Test D (TESTED): Transaction Succeeded = true | Child status: Processed (2)");
  });
});
