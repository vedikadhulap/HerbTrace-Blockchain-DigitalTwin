/**
 * ============================================================
 * HerbTrace — Spatiotemporal Fraud Detection Service
 * ============================================================
 *
 * Evaluates consecutive lifecycle stages (CREATE -> LAB TEST -> PROCESS -> TRANSFER)
 * for physical movement plausibility based on Haversine distance and elapsed time.
 *
 * Key parameters:
 *   - MAX_REASONABLE_SPEED_KMH = 120 (configurable threshold)
 *   - Missing/invalid coordinates or zero/negative time gaps produce status: "insufficient_data"
 *   - Never classifies missing data as fraud.
 *   - Security/informational check only (never blocks blockchain execution).
 */

const { haversineDistance } = require("./multiOracleService");

const MAX_REASONABLE_SPEED_KMH = 120;

/**
 * Check spatiotemporal validity between two consecutive stage data points.
 *
 * @param {object} prevStage - { latitude, longitude, timestamp }
 * @param {object} currStage - { latitude, longitude, timestamp }
 * @param {string} stageTransition - e.g. "CREATE -> LAB TEST"
 * @param {number} thresholdKmh - Max allowed speed in km/h (default 120)
 * @returns {object} Fraud check result
 */
const checkStageTransitionFraud = (
  prevStage,
  currStage,
  stageTransition = "Stage Transition",
  thresholdKmh = MAX_REASONABLE_SPEED_KMH
) => {
  // Validate input objects
  if (!prevStage || !currStage) {
    return {
      suspicious: false,
      status: "insufficient_data",
      stageTransition,
      thresholdKmh,
      reason: "Missing stage data for comparison",
    };
  }

  // Validate coordinates
  if (
    prevStage.latitude == null ||
    prevStage.longitude == null ||
    currStage.latitude == null ||
    currStage.longitude == null
  ) {
    return {
      suspicious: false,
      status: "insufficient_data",
      stageTransition,
      thresholdKmh,
      reason: "Missing or null GPS coordinates",
    };
  }

  const lat1 = Number(prevStage.latitude);
  const lon1 = Number(prevStage.longitude);
  const lat2 = Number(currStage.latitude);
  const lon2 = Number(currStage.longitude);

  const isValidCoord = (lat, lon) =>
    !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  if (!isValidCoord(lat1, lon1) || !isValidCoord(lat2, lon2)) {
    return {
      suspicious: false,
      status: "insufficient_data",
      stageTransition,
      thresholdKmh,
      reason: "Missing or invalid GPS coordinates",
    };
  }

  // Validate timestamps
  const time1 = prevStage.timestamp ? new Date(prevStage.timestamp).getTime() : NaN;
  const time2 = currStage.timestamp ? new Date(currStage.timestamp).getTime() : NaN;

  if (isNaN(time1) || isNaN(time2)) {
    return {
      suspicious: false,
      status: "insufficient_data",
      stageTransition,
      thresholdKmh,
      reason: "Missing or invalid stage timestamps",
    };
  }

  const timeDiffMs = time2 - time1;

  if (timeDiffMs <= 0) {
    return {
      suspicious: false,
      status: "insufficient_data",
      stageTransition,
      thresholdKmh,
      timeGapHours: Math.round((timeDiffMs / 3600000) * 10000) / 10000,
      reason: timeDiffMs === 0 ? "Zero time difference between stages" : "Negative time difference (timestamp mismatch)",
    };
  }

  // Calculate distance in km
  const distanceMeters = haversineDistance(lat1, lon1, lat2, lon2);
  const distanceKm = distanceMeters / 1000;
  const timeGapHours = timeDiffMs / 3600000;

  // Implied speed in km/h
  const impliedSpeedKmh = distanceKm / timeGapHours;

  const round4 = (val) => Math.round(val * 10000) / 10000;

  const isSuspicious = impliedSpeedKmh > thresholdKmh;

  return {
    suspicious: isSuspicious,
    status: "checked",
    stageTransition,
    distanceKm: round4(distanceKm),
    timeGapHours: round4(timeGapHours),
    impliedSpeedKmh: round4(impliedSpeedKmh),
    thresholdKmh,
    reason: isSuspicious
      ? `Implied travel speed (${round4(impliedSpeedKmh)} km/h) exceeds configured threshold (${thresholdKmh} km/h)`
      : `Movement speed (${round4(impliedSpeedKmh)} km/h) is within normal bounds`,
  };
};

/**
 * Check entire batch lifecycle for spatiotemporal anomalies across all completed transitions.
 *
 * @param {object} batch - Batch document or object containing stage locations & timestamps
 * @param {number} thresholdKmh - Max speed threshold
 * @returns {object} Batch-level spatiotemporal fraud analysis
 */
const checkBatchSpatiotemporalFraud = (batch, thresholdKmh = MAX_REASONABLE_SPEED_KMH) => {
  if (!batch) {
    return {
      batchId: null,
      suspicious: false,
      status: "insufficient_data",
      reason: "No batch data provided",
      transitions: [],
    };
  }

  // Extract stage coordinates and timestamps from batch object
  const stages = [];

  // Stage 0: CREATE
  if (batch.location && batch.location.latitude != null && batch.location.longitude != null) {
    stages.push({
      name: "CREATE",
      latitude: batch.location.latitude,
      longitude: batch.location.longitude,
      timestamp: batch.harvestDate || batch.createdAt,
    });
  }

  // Stage 1: LAB TEST
  if (batch.labLocation && batch.labLocation.latitude != null && batch.labLocation.longitude != null) {
    stages.push({
      name: "LAB TEST",
      latitude: batch.labLocation.latitude,
      longitude: batch.labLocation.longitude,
      timestamp: batch.labData?.testedAt || batch.updatedAt,
    });
  }

  // Stage 2: PROCESS
  if (batch.processLocation && batch.processLocation.latitude != null && batch.processLocation.longitude != null) {
    stages.push({
      name: "PROCESS",
      latitude: batch.processLocation.latitude,
      longitude: batch.processLocation.longitude,
      timestamp: batch.processorData?.processedAt || batch.updatedAt,
    });
  }

  // Stage 3: TRANSFER
  if (batch.transferLocation && batch.transferLocation.latitude != null && batch.transferLocation.longitude != null) {
    stages.push({
      name: "TRANSFER",
      latitude: batch.transferLocation.latitude,
      longitude: batch.transferLocation.longitude,
      timestamp: batch.transferData?.transferredAt || batch.updatedAt,
    });
  }

  if (stages.length < 2) {
    return {
      batchId: batch.batchId || null,
      suspicious: false,
      status: "insufficient_data",
      reason: `Only ${stages.length} stage(s) recorded with valid location. Need at least 2 consecutive stages for spatiotemporal analysis.`,
      transitions: [],
    };
  }

  const transitions = [];
  let isAnySuspicious = false;
  let maxSpeed = 0;

  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const curr = stages[i];
    const label = `${prev.name} -> ${curr.name}`;

    const res = checkStageTransitionFraud(prev, curr, label, thresholdKmh);
    transitions.push(res);

    if (res.suspicious) isAnySuspicious = true;
    if (res.status === "checked" && res.impliedSpeedKmh > maxSpeed) {
      maxSpeed = res.impliedSpeedKmh;
    }
  }

  return {
    batchId: batch.batchId || null,
    suspicious: isAnySuspicious,
    status: transitions.some((t) => t.status === "checked") ? "checked" : "insufficient_data",
    maxImpliedSpeedKmh: maxSpeed,
    thresholdKmh,
    transitions,
    summary: isAnySuspicious
      ? "⚠️ Spatiotemporal anomaly detected: implied speed exceeds reasonable threshold between stages."
      : "✅ Spatiotemporal verification passed: movement across stages is plausible.",
  };
};

module.exports = {
  MAX_REASONABLE_SPEED_KMH,
  checkStageTransitionFraud,
  checkBatchSpatiotemporalFraud,
};
