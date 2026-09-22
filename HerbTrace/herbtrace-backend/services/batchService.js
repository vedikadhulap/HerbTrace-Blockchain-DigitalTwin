const { ethers } = require("ethers");
const Batch = require("../models/Batch");
const { getContract } = require("./blockchainService");
const contract = getContract("farmer");

// ─── Feature flags (read once at startup) ────────────────────────────────────
const MERKLE_ENABLED = process.env.ENABLE_MERKLE_ANCHORING === "true";
const ORACLE_ENABLED = process.env.ENABLE_MULTI_ORACLE       === "true";

// ─── Lazy-load feature modules (only if flags are enabled) ───────────────────
// Using lazy require so the app still boots even if the new models are missing
const getMerkleService        = () => require("./merkleService");
const getMultiOracleService   = () => require("./multiOracleService");
const getBatchMerkleRootModel = () => require("../models/BatchMerkleRoot");
const getLocationVerifModel   = () => require("../models/LocationVerification");

// ─── GPS / Oracle Verification ───────────────────────────────────────────────

/**
 * Verifies GPS coordinates against typed location.
 * When ENABLE_MULTI_ORACLE=true  → uses 3-oracle consensus (more reliable)
 * When ENABLE_MULTI_ORACLE=false → uses single Nominatim call (original behaviour)
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} typedLocation  User-typed location string
 * @param {string} batchId        For storing LocationVerification record
 * @param {string} stage          "CREATE"|"TEST"|"PROCESS"|"TRANSFER"
 * @returns {{ matches: boolean, detectedLocation: string|null, consensusResult: object|null }}
 */
const verifyGPSMatchesLocation = async (latitude, longitude, typedLocation, batchId = null, stage = "CREATE") => {
  if (!latitude || !longitude || !typedLocation) return { matches: true, detectedLocation: null, consensusResult: null };

  // ── Multi-Oracle path (Feature 2) ────────────────────────────────────────
  if (ORACLE_ENABLED) {
    try {
      const { runConsensus } = getMultiOracleService();
      const consensusResult = await runConsensus(latitude, longitude, typedLocation);

      // Persist the oracle results to MongoDB if batchId is provided
      if (batchId) {
        const stageMap = { CREATE: 0, TEST: 1, PROCESS: 2, TRANSFER: 3 };
        const LocationVerification = getLocationVerifModel();
        await LocationVerification.findOneAndUpdate(
          { batchId, stage },
          {
            batchId, stage,
            stageIndex:     stageMap[stage] ?? 0,
            latitude,
            longitude,
            typedLocation,
            oracleResults:  consensusResult.oracleResults,
            agreementPairs: consensusResult.agreementPairs,
            consensus:      consensusResult.consensus,
            confidence:     consensusResult.confidence,
            verified:       consensusResult.verified,
            agreedLocation: consensusResult.agreedLocation,
            typedMatches:   consensusResult.typedMatches,
            successCount:   consensusResult.successCount,
            failureCount:   consensusResult.failureCount,
            thresholdM:     consensusResult.thresholdM,
            durationMs:     consensusResult.durationMs,
            message:        consensusResult.message,
          },
          { upsert: true, new: true }
        );
      }

      // If no_data (all oracles failed), fall through to legacy check
      if (consensusResult.consensus === "no_data") {
        console.warn(`[MultiOracle] All oracles failed for ${batchId} stage ${stage} — falling back to legacy check`);
        // Fall through to legacy path below
      } else {
        const matches = consensusResult.verified && (consensusResult.typedMatches !== false);
        return {
          matches,
          detectedLocation: consensusResult.agreedLocation,
          consensusResult,
        };
      }
    } catch (err) {
      console.error("[MultiOracle] Consensus error — falling back to legacy Nominatim:", err.message);
      // Fall through to legacy single-oracle check
    }
  }

  // ── Legacy single-oracle path (original Nominatim behaviour) ─────────────
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;
    const response = await fetch(url, {
      headers: { "User-Agent": "HerbTrace/1.0" }, // Nominatim requires a User-Agent header
    });
    const data = await response.json();

    const city     = (data.address?.city    || data.address?.town    || data.address?.village || "").toLowerCase();
    const state    = (data.address?.state   || "").toLowerCase();
    const district = (data.address?.county  || "").toLowerCase();
    const typed    = typedLocation.toLowerCase();
    const typedFirstPart = typed.split(",")[0].trim();

    const locationMatches =
      (city     && typed.includes(city))     ||
      (state    && typed.includes(state))    ||
      (district && typed.includes(district)) ||
      (city     && city.includes(typedFirstPart))     ||
      (district && district.includes(typedFirstPart));

    return {
      matches: locationMatches,
      detectedLocation: `${data.address?.city || data.address?.town || data.address?.village || ""}, ${data.address?.state || ""}`.trim(),
      consensusResult: null,
    };
  } catch (err) {
    console.error("GPS verification lookup error:", err);
    // If geocoding fails (e.g. network issue), pass through smoothly
    return { matches: true, detectedLocation: null, consensusResult: null };
  }
};

// ─── Location-only resolver (no typed comparison) ─────────────────────────────

/**
 * Calls the multi-oracle service purely to TRANSLATE GPS → human-readable place name.
 * Used by Lab Test, Process, and Transfer stages where there is no typed location
 * claim to compare against — we just want to record WHERE the action happened.
 *
 * - Never blocks the request (errors are caught and logged).
 * - Saves a LocationVerification record to MongoDB (same model as createBatch).
 * - Returns the agreed place name string, e.g. "Mumbai, Maharashtra", or null.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} batchId   For the LocationVerification record
 * @param {string} stage     "TEST" | "PROCESS" | "TRANSFER"
 * @returns {Promise<string|null>}  agreedLocation or null
 */
const resolveLocationOnly = async (latitude, longitude, batchId, stage) => {
  if (!ORACLE_ENABLED || !latitude || !longitude) return null;

  try {
    const { runConsensus } = getMultiOracleService();
    // Pass empty string — oracles still reverse-geocode and agree on a place name,
    // but typedMatches won't be checked (no mismatch can block this stage).
    const consensusResult = await runConsensus(latitude, longitude, "");

    // Persist to MongoDB so the Verify page and Admin panel can display it
    if (batchId) {
      const stageMap = { CREATE: 0, TEST: 1, PROCESS: 2, TRANSFER: 3 };
      const LocationVerification = getLocationVerifModel();
      await LocationVerification.findOneAndUpdate(
        { batchId, stage },
        {
          batchId, stage,
          stageIndex:     stageMap[stage] ?? 0,
          latitude,
          longitude,
          typedLocation:  "",               // no typed claim for these stages
          oracleResults:  consensusResult.oracleResults,
          agreementPairs: consensusResult.agreementPairs,
          consensus:      consensusResult.consensus,
          confidence:     consensusResult.confidence,
          verified:       consensusResult.verified,
          agreedLocation: consensusResult.agreedLocation,
          typedMatches:   null,             // n/a — no comparison was done
          successCount:   consensusResult.successCount,
          failureCount:   consensusResult.failureCount,
          thresholdM:     consensusResult.thresholdM,
          durationMs:     consensusResult.durationMs,
          message:        consensusResult.message,
        },
        { upsert: true, new: true }
      );
    }

    const place = consensusResult.agreedLocation || null;
    console.log(`[Oracle] ${stage} for ${batchId} resolved to: ${place}`);
    return place;

  } catch (err) {
    // Non-critical — log and continue; the stage data is still recorded
    console.error(`[Oracle] resolveLocationOnly failed for ${batchId}/${stage}:`, err.message);
    return null;
  }
};

// ─── Merkle Tree Helpers ──────────────────────────────────────────────────────

/**
 * Stage index constants — must match STAGE in merkleService.js
 */
const STAGE_INDEX = { CREATE: 0, TEST: 1, PROCESS: 2, TRANSFER: 3 };

/**
 * Update (or create) a BatchMerkleRoot document for the given batch+stage.
 * Recomputes the Merkle root with the new leaf filled in.
 *
 * @param {string} batchId
 * @param {number} stageIndex   0–3
 * @param {string} leafDataStr  Raw data string that will be hashed as this leaf
 * @returns {Promise<{ merkleRoot: string, allFilled: boolean }>}
 */
const updateMerkleLeaf = async (batchId, stageIndex, leafDataStr) => {
  if (!MERKLE_ENABLED) return null;

  try {
    const { buildMerkleTree, generateProof } = getMerkleService();
    const BatchMerkleRoot = getBatchMerkleRootModel();

    // Fetch or create the BatchMerkleRoot document
    let merkleDoc = await BatchMerkleRoot.findOne({ batchId });
    if (!merkleDoc) {
      merkleDoc = new BatchMerkleRoot({
        batchId,
        leafData:        [null, null, null, null],
        stagesCompleted: [false, false, false, false],
        completedCount:  0,
      });
    }

    // Set the leaf data for this stage
    merkleDoc.leafData[stageIndex]        = leafDataStr;
    merkleDoc.stagesCompleted[stageIndex] = true;
    merkleDoc.completedCount = merkleDoc.stagesCompleted.filter(Boolean).length;

    // Recompute the full tree with current leaf data (nulls become EMPTY leaves)
    const { leaves, root } = buildMerkleTree(merkleDoc.leafData);
    merkleDoc.leaves     = leaves;
    merkleDoc.merkleRoot = root;

    // Regenerate proof for the updated stage
    const proofResult = generateProof(merkleDoc.leafData, stageIndex);
    const existingProofIdx = merkleDoc.proofs.findIndex((p) => p.stageIndex === stageIndex);
    const proofEntry = {
      stageIndex,
      stageName: ["CREATE", "TEST", "PROCESS", "TRANSFER"][stageIndex],
      leaf:      proofResult.leaf,
      proof:     proofResult.proof,
      leafData:  leafDataStr,
      verified:  true,
    };
    if (existingProofIdx >= 0) {
      merkleDoc.proofs[existingProofIdx] = proofEntry;
    } else {
      merkleDoc.proofs.push(proofEntry);
    }

    // Mark arrays as modified (Mongoose mixed types need explicit marking)
    merkleDoc.markModified("leafData");
    merkleDoc.markModified("stagesCompleted");
    merkleDoc.markModified("proofs");
    merkleDoc.markModified("leaves");

    await merkleDoc.save();

    const allFilled = merkleDoc.completedCount === 4;
    console.log(`[Merkle] Batch ${batchId} — stage ${stageIndex} leaf updated. Root: ${root.slice(0, 16)}... All filled: ${allFilled}`);

    return { merkleRoot: root, allFilled, merkleDoc };
  } catch (err) {
    // Merkle update is non-critical — log but don't throw
    console.error("[Merkle] updateMerkleLeaf error:", err.message);
    return null;
  }
};

/**
 * Anchor the final Merkle root on-chain. Called once when Transfer completes.
 * Uses the distributor wallet (already has contract permissions).
 *
 * @param {string} batchId
 * @param {string} merkleRoot  hex Merkle root
 * @returns {Promise<string>} tx hash
 */
const anchorMerkleRootOnChain = async (batchId, merkleRoot) => {
  if (!MERKLE_ENABLED) return null;

  try {
    const { toBytes32 } = getMerkleService();
    const BatchMerkleRoot = getBatchMerkleRootModel();

    // New contract: anchorMerkleRoot(batchId, stageIndex, merkleRoot) requires DEFAULT_ADMIN_ROLE
    // We use stageIndex=3 (TRANSFER) to indicate the final/complete root anchor
    const adminContract = getContract("admin");
    const bytes32Root = toBytes32(merkleRoot);
    const TRANSFER_STAGE_INDEX = 3n; // uint256 in the new contract

    const tx      = await adminContract.anchorMerkleRoot(batchId, TRANSFER_STAGE_INDEX, bytes32Root);
    const receipt = await tx.wait();

    // Update MongoDB with anchor confirmation
    await BatchMerkleRoot.findOneAndUpdate(
      { batchId },
      { anchored: true, anchoredTxHash: receipt.hash, anchoredAt: new Date() },
      { new: true }
    );

    console.log(`[Merkle] ✅ Root anchored on-chain for batch ${batchId}. TxHash: ${receipt.hash}`);
    return receipt.hash;
  } catch (err) {
    console.error("[Merkle] anchorMerkleRootOnChain error:", err.message);
    return null;
  }
};

const createBatch = async (data) => {
  const {
    batchId, herbType, herbVariety, farmingMethod, estimatedMoisture, lotNumber,
    farmerWallet, farmLocation, harvestDate, quantityKg, expectedDryWeight,
    latitude, longitude,
  } = data;

  // Verify GPS coordinates match the typed farm location before accepting the batch
  // When ENABLE_MULTI_ORACLE=true, this runs 3-oracle consensus instead of single Nominatim
  const verification = await verifyGPSMatchesLocation(latitude, longitude, farmLocation, batchId, "CREATE");
  if (!verification.matches) {
    throw new Error(
      `GPS location mismatch: your coordinates indicate ${verification.detectedLocation}, but you entered "${farmLocation}". Please submit this batch from the actual farm location.`
    );
  }

  const dataString = JSON.stringify({
    batchId, herbType, herbVariety, farmingMethod, farmerWallet,
    farmLocation, harvestDate, quantityKg, latitude, longitude,
  });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  const tx = await contract.createBatch(batchId, dataHash);
  const receipt = await tx.wait();

  // chainId = batchId for a brand-new raw batch (it starts its own chain)
  const chainId = batchId;

  const batch = await Batch.create({
    batchId, chainId,                        // <── chainId set here
    herbType, herbVariety, farmingMethod, estimatedMoisture, lotNumber,
    farmerWallet, farmLocation,
    location: { latitude, longitude },
    harvestDate, quantityKg, expectedDryWeight,
    dataHash, txHash: receipt.hash, status: "CREATED",
    createdBy: data.userId,
  });

  // ── Feature 1: Record Leaf 0 (CREATE stage) — keyed by chainId ─────────────
  if (MERKLE_ENABLED) {
    const { buildLeafData, STAGE } = getMerkleService();
    const leafStr = buildLeafData("CREATE", {
      batchId, herbType, herbVariety, farmingMethod, farmerWallet,
      farmLocation, harvestDate, quantityKg, latitude, longitude,
    });
    await updateMerkleLeaf(chainId, STAGE.CREATE, leafStr);
  }

  return batch;
};

const getBatchById = async (batchId) => {
  const batch = await Batch.findOne({ batchId });
  return batch;
};

const recordLabTest = async (data) => {
  const { batchId, testResults, labWallet, latitude, longitude, userId } = data;

  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) throw new Error("Batch not found");

  // ── Feature 2: Resolve GPS → human-readable place name (non-blocking) ──────
  // resolveLocationOnly() calls the 3 oracles to translate lat/lng into a city name.
  // It never throws — if all oracles fail, agreedLocation is just null.
  const agreedLocation = await resolveLocationOnly(latitude, longitude, batchId, "TEST");

  const dataString = JSON.stringify({ batchId, testResults, labWallet, latitude, longitude });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  const labContract = getContract("lab");
  const tx = await labContract.recordTest(batchId, dataHash);
  const receipt = await tx.wait();

  existingBatch.status    = "TESTED";
  existingBatch.dataHash  = dataHash;
  existingBatch.txHash    = receipt.hash;
  existingBatch.labData   = JSON.parse(testResults);
  existingBatch.labLocation = { latitude, longitude };
  if (userId) existingBatch.testedBy = userId;
  await existingBatch.save();

  // ── Feature 1: Record Leaf 1 (TEST stage) — use this batch's chainId ──────
  if (MERKLE_ENABLED) {
    const { buildLeafData, STAGE } = getMerkleService();
    // chainId fallback: old batches without chainId use their own batchId
    const chainId = existingBatch.chainId || batchId;
    const leafStr = buildLeafData("TEST", { batchId, testResults, labWallet, latitude, longitude });
    await updateMerkleLeaf(chainId, STAGE.TEST, leafStr);
  }

  // Return both the batch document AND the resolved place name so the
  // controller can include agreedLocation in the API response
  return { batch: existingBatch, agreedLocation };
};

const processBatch = async (data) => {
  const { newBatchId, parentBatchIds, processorNotes, latitude, longitude, userId } = data;

  const parents = await Batch.find({ batchId: { $in: parentBatchIds } });
  if (parents.length !== parentBatchIds.length) {
    throw new Error("One or more parent batches not found");
  }

  // ── Feature 2: Resolve GPS → human-readable place name (non-blocking) ──────
  const agreedLocation = await resolveLocationOnly(latitude, longitude, newBatchId, "PROCESS");

  // Inherit chainId from the first parent batch — this keeps the tree unified.
  // Raw herbs (BATCH-A) → processed powder (BATCH-B): BATCH-B inherits BATCH-A's chainId.
  // Fallback: if parent has no chainId (old batch), use the parent's own batchId.
  const inheritedChainId = parents[0].chainId || parents[0].batchId;

  const dataString = JSON.stringify({ newBatchId, parentBatchIds, processorNotes, latitude, longitude });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  const processorContract = getContract("processor");
  const tx = await processorContract.processBatch(newBatchId, parentBatchIds, dataHash);
  const receipt = await tx.wait();

  const newBatch = await Batch.create({
    batchId:         newBatchId,
    chainId:         inheritedChainId,       // <── inherited from parent
    herbType:        parents[0].herbType,
    farmerWallet:    parents[0].farmerWallet,
    dataHash,
    txHash:          receipt.hash,
    status:          "PROCESSED",
    parentBatchIds,
    processorData:   JSON.parse(processorNotes),
    processLocation: { latitude, longitude },
    processedBy:     userId,
  });

  // ── Feature 1: Record Leaf 2 (PROCESS stage) — keyed by inheritedChainId ──
  if (MERKLE_ENABLED) {
    const { buildLeafData, STAGE } = getMerkleService();
    const leafStr = buildLeafData("PROCESS", { newBatchId, parentBatchIds, processorNotes, latitude, longitude });
    await updateMerkleLeaf(inheritedChainId, STAGE.PROCESS, leafStr);
  }

  return { batch: newBatch, agreedLocation };
};

const transferBatch = async (data) => {
  const { batchId, newOwner, senderRole, transferData, latitude, longitude, userId } = data;

  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) throw new Error("Batch not found");

  // ── Feature 2: Resolve GPS → human-readable place name (non-blocking) ──────
  const agreedLocation = await resolveLocationOnly(latitude, longitude, batchId, "TRANSFER");

  const dataString = JSON.stringify({ batchId, newOwner, transferData, latitude, longitude });
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

  // If newOwner is a valid Ethereum address, use it; otherwise fallback to an address for contract compatibility
  const recipientAddress = ethers.isAddress(newOwner)
    ? newOwner
    : "0x0000000000000000000000000000000000000001";

  const senderContract = getContract(senderRole);
  const tx = await senderContract.transferCustody(batchId, recipientAddress, dataHash);
  const receipt = await tx.wait();

  existingBatch.status          = "TRANSFERRED";
  existingBatch.dataHash        = dataHash;
  existingBatch.txHash          = receipt.hash;
  existingBatch.transferData    = JSON.parse(transferData);
  existingBatch.transferLocation = { latitude, longitude };
  if (userId) existingBatch.transferredBy = userId;
  await existingBatch.save();

  // ── Feature 1: Record Leaf 3 (TRANSFER stage) — use chainId, anchor once ──
  // chainId fallback: old batches without chainId use their own batchId.
  // This is the FINAL stage — after this leaf the root is complete and anchored.
  if (MERKLE_ENABLED) {
    const { buildLeafData, STAGE } = getMerkleService();
    const chainId = existingBatch.chainId || batchId;
    const leafStr = buildLeafData("TRANSFER", { batchId, newOwner, transferData, latitude, longitude });
    const result  = await updateMerkleLeaf(chainId, STAGE.TRANSFER, leafStr);

    if (result?.allFilled && result.merkleRoot) {
      // All 4 leaves are now filled — anchor the final root on-chain once
      await anchorMerkleRootOnChain(chainId, result.merkleRoot);
    }
  }

  return { batch: existingBatch, agreedLocation };
};

const verifyBatch = async (batchId) => {
  const batch = await Batch.findOne({ batchId });
  if (!batch) throw new Error("Batch not found");

  let parents = [];
  if (batch.parentBatchIds && batch.parentBatchIds.length > 0) {
    parents = await Batch.find({ batchId: { $in: batch.parentBatchIds } });
  }

  return { batch, parents };
};

const { uploadToPinata } = require("./pinataService");

const addImageToBatch = async (batchId, file) => {
  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) throw new Error("Batch not found");

  const imageUrl = await uploadToPinata(file);
  existingBatch.images.push(imageUrl);
  await existingBatch.save();

  return existingBatch;
};

const { generateQRCode } = require("./qrService");

const getBatchQRCode = async (batchId) => {
  const existingBatch = await Batch.findOne({ batchId });
  if (!existingBatch) throw new Error("Batch not found");

  const qrCode = await generateQRCode(batchId);
  return qrCode;
};

// Returns the total count of all batch records in the database
const getBatchCount = async () => {
  return await Batch.countDocuments();
};

// Returns the 5 most recently updated batches for the home page activity feed
const getRecentActivity = async () => {
  return await Batch.find({}, { batchId: 1, herbType: 1, status: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .limit(5);
};

// ─── Feature 1: Get Merkle Proof for a stage ─────────────────────────────────

/**
 * Returns the stored Merkle proof for a specific stage of a batch.
 * The caller can use this proof to independently verify the stage data
 * without needing any raw data from the server.
 *
 * @param {string} batchId
 * @param {number} stageIndex  0–3
 * @returns {Promise<object>}
 */
const getMerkleProof = async (batchId, stageIndex) => {
  const BatchMerkleRoot = getBatchMerkleRootModel();

  // Accept either a batchId OR a chainId — resolve to the Merkle document.
  // A raw batch's batchId == its chainId, so this always works for the root batch.
  // For querying by a processed batch's own batchId, look up its chainId first.
  let merkleDoc = await BatchMerkleRoot.findOne({ batchId });

  if (!merkleDoc) {
    // batchId might be a processed batchId — look up its chainId in the Batch collection
    const batchRecord = await Batch.findOne({ batchId });
    if (batchRecord?.chainId && batchRecord.chainId !== batchId) {
      merkleDoc = await BatchMerkleRoot.findOne({ batchId: batchRecord.chainId });
    }
  }

  if (!merkleDoc) throw new Error("Merkle tree not found for this batch. Merkle anchoring may not be enabled.");

  const idx = parseInt(stageIndex, 10);
  if (idx < 0 || idx > 3) throw new Error("stageIndex must be 0, 1, 2, or 3");

  if (!merkleDoc.stagesCompleted[idx]) {
    throw new Error(`Stage ${idx} (${["CREATE","TEST","PROCESS","TRANSFER"][idx]}) has not been completed yet for this batch.`);
  }

  const proof = merkleDoc.proofs.find((p) => p.stageIndex === idx);
  if (!proof) throw new Error("Proof not found for this stage");

  return {
    batchId,
    chainId:       merkleDoc.batchId,    // the root batchId that keys this Merkle tree
    stageIndex:    idx,
    stageName:     proof.stageName,
    leaf:          proof.leaf,
    proof:         proof.proof,
    merkleRoot:    merkleDoc.merkleRoot,
    anchored:      merkleDoc.anchored,
    anchoredTxHash: merkleDoc.anchoredTxHash,
    stagesCompleted: merkleDoc.stagesCompleted,
    completedCount:  merkleDoc.completedCount,
    howToVerify: {
      step1: "Hash your stage data string with SHA-256",
      step2: "Hash it with proof[0] (sort both lexicographically, hash concatenation)",
      step3: "Hash the result with proof[1] (same sort-and-hash)",
      step4: `Compare to merkleRoot: ${merkleDoc.merkleRoot}`,
      step5: "If equal, the data was in the original tree — authenticity proven",
    },
  };
};

// ─── Feature 2: Get Location Verifications for a batch ───────────────────────

/**
 * Returns all oracle-based location verifications for a batch (up to 4 stages).
 *
 * @param {string} batchId
 * @returns {Promise<object[]>}
 */
const getLocationVerifications = async (batchId) => {
  const LocationVerification = getLocationVerifModel();
  const records = await LocationVerification.find({ batchId }).sort({ stageIndex: 1 });
  if (!records.length) {
    throw new Error("No location verifications found for this batch. Multi-oracle may not be enabled.");
  }
  return records;
};

module.exports = {
  createBatch,
  getBatchById,
  recordLabTest,
  processBatch,
  transferBatch,
  verifyBatch,
  addImageToBatch,
  getBatchQRCode,
  getBatchCount,
  getRecentActivity,
  // Feature 1
  getMerkleProof,
  // Feature 2
  getLocationVerifications,
};