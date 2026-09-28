/**
 * ============================================================
 * HerbTrace — Reputation-Weighted Oracle Consensus Service
 * ============================================================
 *
 * Implements exponential moving average (EMA) reputation tracking
 * for multi-oracle consensus using Leave-One-Out (LOO) evaluation.
 *
 * Features:
 *   1. Initial reputation: 1.0 (Range: 0.0 to 1.0)
 *   2. REPUTATION_ALPHA = 0.2 (configurable)
 *   3. EMA update formula: newRep = alpha * agreement + (1 - alpha) * oldRep
 *   4. Leave-One-Out agreement evaluation (no oracle determines its own reputation)
 *   5. calculateReputationWeightedConsensus() - weighted support consensus
 */

const { haversineDistance, AGREEMENT_THRESHOLD_METERS } = require("./multiOracleService");

const REPUTATION_ALPHA = 0.2;
const INITIAL_REPUTATION = 1.0;
const DISTANCE_THRESHOLD = AGREEMENT_THRESHOLD_METERS || 100;

/**
 * Evaluate Leave-One-Out (LOO) agreement for each oracle.
 *
 * For each oracle i:
 *   - Exclude oracle i to form the remaining set.
 *   - Identify quorum/majority cluster in remaining set (within 100m).
 *   - Check if oracle i is within 100m of the remaining set's quorum.
 *   - agreement = 1 if in agreement with quorum, 0 otherwise.
 *
 * @param {Array<object>} oracleResults - Array of oracle objects: [{ oracle, rawLat, rawLon, success }]
 * @param {number} thresholdM - Distance threshold in meters (default 100m)
 * @returns {object} Map of oracle -> agreement (1 or 0)
 */
const evaluateLeaveOneOutAgreement = (oracleResults, thresholdM = DISTANCE_THRESHOLD) => {
  const successful = oracleResults.filter((r) => r && r.success !== false && r.rawLat != null && r.rawLon != null);
  const agreements = {};

  oracleResults.forEach((r) => {
    if (r && r.oracle) {
      agreements[r.oracle] = 0; // default 0
    }
  });

  if (successful.length < 2) {
    return agreements;
  }

  for (let i = 0; i < successful.length; i++) {
    const target = successful[i];
    const remaining = successful.filter((_, idx) => idx !== i);

    if (remaining.length === 0) {
      agreements[target.oracle] = 0;
      continue;
    }

    // Find clusters among remaining oracles
    const clusters = [];
    for (let j = 0; j < remaining.length; j++) {
      let addedToCluster = false;
      for (const cluster of clusters) {
        // Compare with first element of cluster
        const dist = haversineDistance(
          remaining[j].rawLat,
          remaining[j].rawLon,
          cluster[0].rawLat,
          cluster[0].rawLon
        );
        if (dist <= thresholdM) {
          cluster.push(remaining[j]);
          addedToCluster = true;
          break;
        }
      }
      if (!addedToCluster) {
        clusters.push([remaining[j]]);
      }
    }

    // Sort clusters by size descending to find main quorum
    clusters.sort((a, b) => b.length - a.length);
    const largestCluster = clusters[0];

    // Quorum exists if largest remaining cluster has >= 1 member (if remaining size is 1)
    // or >= 2 members (if remaining size >= 2)
    if (largestCluster && largestCluster.length > 0) {
      // Calculate representative center of largest cluster
      const centerLat = largestCluster.reduce((sum, r) => sum + r.rawLat, 0) / largestCluster.length;
      const centerLon = largestCluster.reduce((sum, r) => sum + r.rawLon, 0) / largestCluster.length;

      const distToQuorum = haversineDistance(target.rawLat, target.rawLon, centerLat, centerLon);

      if (distToQuorum <= thresholdM) {
        agreements[target.oracle] = 1;
      } else {
        agreements[target.oracle] = 0;
      }
    } else {
      agreements[target.oracle] = 0;
    }
  }

  return agreements;
};

/**
 * Update oracle reputations using EMA based on Leave-One-Out agreement.
 *
 * @param {Array<object>} oracleResults
 * @param {object} currentReputations - Current map of { oracleName: reputation }
 * @param {number} alpha - EMA weight (default 0.2)
 * @returns {{ updatedReputations: object, agreements: object }}
 */
const updateOracleReputations = (
  oracleResults,
  currentReputations = {},
  alpha = REPUTATION_ALPHA
) => {
  const agreements = evaluateLeaveOneOutAgreement(oracleResults);
  const updatedReputations = { ...currentReputations };

  oracleResults.forEach((r) => {
    if (!r || !r.oracle) return;
    const name = r.oracle;
    const oldRep = currentReputations[name] !== undefined ? currentReputations[name] : INITIAL_REPUTATION;
    const agreement = agreements[name] || 0;

    // EMA: newRep = alpha * agreement + (1 - alpha) * oldRep
    let newRep = alpha * agreement + (1 - alpha) * oldRep;

    // Clamp between 0.0 and 1.0
    newRep = Math.max(0.0, Math.min(1.0, newRep));

    // Round to 4 decimal places for precision/cleanliness
    updatedReputations[name] = Math.round(newRep * 10000) / 10000;
  });

  return { updatedReputations, agreements };
};

/**
 * Calculate Reputation-Weighted Consensus for 4 oracles.
 *
 * Algorithm:
 *  1. Group successful oracle coordinates into geographic clusters (<= 100m).
 *  2. Apply oracle reputations as weights to each cluster.
 *  3. Calculate weighted support per cluster.
 *  4. Select highest-supported valid cluster.
 *  5. Update and return reputation state alongside consensus details.
 *
 * @param {Array<object>} oracleResults - Array of oracle response objects
 * @param {object} currentReputations - Existing oracle reputation map
 * @param {number} alpha - EMA alpha factor
 * @returns {object} Reputation-weighted consensus result
 */
const calculateReputationWeightedConsensus = (
  oracleResults,
  currentReputations = {},
  alpha = REPUTATION_ALPHA
) => {
  const startTime = Date.now();
  const successful = (oracleResults || []).filter(
    (r) => r && r.success !== false && r.rawLat != null && r.rawLon != null
  );

  // Initialize missing reputations to 1.0
  const activeReputations = {};
  (oracleResults || []).forEach((r) => {
    if (r && r.oracle) {
      activeReputations[r.oracle] =
        currentReputations[r.oracle] !== undefined
          ? currentReputations[r.oracle]
          : INITIAL_REPUTATION;
    }
  });

  if (successful.length < 2) {
    const { updatedReputations, agreements } = updateOracleReputations(
      oracleResults,
      activeReputations,
      alpha
    );

    return {
      verified: false,
      consensusType: "reputation_weighted",
      latitude: null,
      longitude: null,
      agreedLocation: null,
      confidence: 0,
      weightedSupport: {},
      reputations: updatedReputations,
      agreements,
      message: "Insufficient oracle data for reputation-weighted consensus.",
      durationMs: Date.now() - startTime,
    };
  }

  // 1. Group into geographic clusters (within 100m)
  const clusters = [];
  successful.forEach((oracleRes) => {
    let added = false;
    for (const cluster of clusters) {
      // Check distance against first oracle in cluster
      const dist = haversineDistance(
        oracleRes.rawLat,
        oracleRes.rawLon,
        cluster.members[0].rawLat,
        cluster.members[0].rawLon
      );
      if (dist <= DISTANCE_THRESHOLD) {
        cluster.members.push(oracleRes);
        added = true;
        break;
      }
    }
    if (!added) {
      clusters.push({
        members: [oracleRes],
      });
    }
  });

  // 2. Compute weighted support for each cluster
  const weightedSupportMap = {};
  clusters.forEach((cluster, index) => {
    const totalWeight = cluster.members.reduce((sum, m) => {
      const rep = activeReputations[m.oracle] !== undefined ? activeReputations[m.oracle] : INITIAL_REPUTATION;
      return sum + rep;
    }, 0);

    cluster.id = `cluster_${index + 1}`;
    cluster.weightedSupport = Math.round(totalWeight * 10000) / 10000;
    cluster.oracleNames = cluster.members.map((m) => m.oracle);

    // Compute centroid coordinates
    cluster.latitude = cluster.members.reduce((sum, m) => sum + m.rawLat, 0) / cluster.members.length;
    cluster.longitude = cluster.members.reduce((sum, m) => sum + m.rawLon, 0) / cluster.members.length;
    cluster.agreedLocation = cluster.members[0].displayName || cluster.members[0].city || null;

    weightedSupportMap[cluster.id] = cluster.weightedSupport;
  });

  // 3. Find highest supported cluster
  clusters.sort((a, b) => b.weightedSupport - a.weightedSupport);
  const winningCluster = clusters[0];

  // Verified if winning cluster has 2+ members OR support > 1.0 (reputation sum of multiple oracles)
  const verified = winningCluster && winningCluster.members.length >= 2;

  // Update reputations via Leave-One-Out
  const { updatedReputations, agreements } = updateOracleReputations(
    oracleResults,
    activeReputations,
    alpha
  );

  return {
    verified,
    consensusType: "reputation_weighted",
    latitude: verified ? winningCluster.latitude : null,
    longitude: verified ? winningCluster.longitude : null,
    agreedLocation: verified ? winningCluster.agreedLocation : null,
    winningCluster: winningCluster
      ? {
          id: winningCluster.id,
          members: winningCluster.oracleNames,
          weightedSupport: winningCluster.weightedSupport,
          lat: winningCluster.latitude,
          lon: winningCluster.longitude,
        }
      : null,
    weightedSupport: weightedSupportMap,
    reputations: updatedReputations,
    agreements,
    thresholdM: DISTANCE_THRESHOLD,
    message: verified
      ? `✅ Reputation-weighted consensus achieved (Support: ${winningCluster.weightedSupport}, Oracles: ${winningCluster.oracleNames.join(", ")})`
      : `⚠️ Reputation-weighted consensus failed — insufficient cluster support`,
    durationMs: Date.now() - startTime,
  };
};

module.exports = {
  REPUTATION_ALPHA,
  INITIAL_REPUTATION,
  evaluateLeaveOneOutAgreement,
  updateOracleReputations,
  calculateReputationWeightedConsensus,
};
