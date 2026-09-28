/**
 * ============================================================
 * HerbTrace — Multi-Oracle Consensus Service
 * ============================================================
 *
 * CONCEPT: The Oracle Problem & Consensus
 * ----------------------------------------
 * A blockchain can't reach the internet. When we verify a GPS
 * coordinate against a location name, we rely on external APIs.
 * If we trust ONE API, we introduce a single point of failure:
 *   - The API could be down
 *   - The API could return wrong data
 *   - The API provider could be compromised
 *
 * SOLUTION — Multi-Oracle Consensus:
 * Ask 3 INDEPENDENT services the same question:
 *   "What place is at latitude X, longitude Y?"
 *
 * Then apply the 2-of-3 majority rule:
 *   - If 2+ answers agree (within 100m) → "verified" (high confidence)
 *   - If all 3 disagree → "low_confidence" (flag for admin review)
 *   - If an API fails → skip it, try to reach 2-of-remaining
 *
 * Distance check uses the Haversine formula — exact great-circle
 * distance on Earth's surface.
 *
 * ── Our 3 Oracles (all free, no API keys required) ─────────────
 *   Oracle 1: Nominatim (OpenStreetMap)  — already used in the app
 *   Oracle 2: BigDataCloud               — free reverse geocoding
 *   Oracle 3: Geocode.maps.co            — free, 1 req/sec limit
 *
 * ── Optional 4th Oracle (with API key) ─────────────────────────
 *   Oracle 4: OpenCage — if OPENCAGE_API_KEY is set in .env
 *
 * ============================================================
 */

const axios = require("axios");

// ─── Configuration ────────────────────────────────────────────────────────────

const AGREEMENT_THRESHOLD_METERS = 100; // 2 oracles must agree within 100m
const REQUEST_TIMEOUT_MS         = 5000; // 5 second per oracle call
const EARTH_RADIUS_KM            = 6371;

// ─── Haversine Distance Formula ──────────────────────────────────────────────

/**
 * Compute the great-circle distance (in metres) between two GPS points.
 *
 * CONCEPT: Haversine formula accounts for Earth's curvature.
 * For small distances (<1km) it's extremely accurate.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in metres
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c * 1000; // convert km → metres
};

// ─── Individual Oracle Queries ────────────────────────────────────────────────

/**
 * Oracle 1: Nominatim (OpenStreetMap)
 * Free, no key. Returns city/town/village + state.
 * Rate limit: 1 req/sec. User-Agent header required.
 */
const queryNominatim = async (lat, lon) => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "User-Agent": "HerbTrace/1.0 (location-verification)" },
  });
  const d = response.data;

  const city    = d.address?.city || d.address?.town || d.address?.village || "";
  const state   = d.address?.state || "";
  const country = d.address?.country || "";

  return {
    oracle:    "nominatim",
    rawLat:    parseFloat(d.lat),
    rawLon:    parseFloat(d.lon),
    city,
    state,
    country,
    displayName: d.display_name || `${city}, ${state}`,
    success:   true,
  };
};

/**
 * Oracle 2: BigDataCloud Reverse Geocoding
 * Completely free, no API key needed. Very fast.
 * Returns high-quality city + state data.
 */
const queryBigDataCloud = async (lat, lon) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
  const d = response.data;

  const city    = d.city || d.locality || d.principalSubdivision || "";
  const state   = d.principalSubdivision || "";
  const country = d.countryName || "";

  return {
    oracle:      "bigdatacloud",
    rawLat:      lat,  // BigDataCloud echoes input coords
    rawLon:      lon,
    city,
    state,
    country,
    displayName: `${city}, ${state}, ${country}`.replace(/^, |, $/g, ""),
    success:     true,
  };
};

/**
 * Oracle 3: Geocode.maps.co
 * Free, no key needed. Returns full display_name + lat/lon.
 * Rate limit: 2 req/sec.
 */
const queryGeocodeMaps = async (lat, lon) => {
  const url = `https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}`;
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    headers: { "User-Agent": "HerbTrace/1.0" },
  });
  const d = response.data;

  const city    = d.address?.city || d.address?.town || d.address?.village || "";
  const state   = d.address?.state || "";
  const country = d.address?.country || "";

  return {
    oracle:      "geocode.maps.co",
    rawLat:      parseFloat(d.lat || lat),
    rawLon:      parseFloat(d.lon || lon),
    city,
    state,
    country,
    displayName: d.display_name || `${city}, ${state}`,
    success:     true,
  };
};

/**
 * Oracle 4 (Optional): OpenCage — only used if OPENCAGE_API_KEY is set.
 */
const queryOpenCage = async (lat, lon) => {
  const key = process.env.OPENCAGE_API_KEY;
  if (!key) return null; // skip if no key

  const url = `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${key}&limit=1`;
  const response = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
  const result = response.data?.results?.[0];
  if (!result) return null;

  const comp = result.components;
  const city    = comp.city || comp.town || comp.village || "";
  const state   = comp.state || comp.state_district || "";
  const country = comp.country || "";

  return {
    oracle:      "opencage",
    rawLat:      result.geometry?.lat || lat,
    rawLon:      result.geometry?.lng || lon,
    city,
    state,
    country,
    displayName: result.formatted || `${city}, ${state}`,
    success:     true,
  };
};

// ─── Consensus Engine ─────────────────────────────────────────────────────────

/**
 * Query all oracles safely (catch individual failures).
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Array>}  Array of successful oracle results
 */
const queryAllOracles = async (lat, lon) => {
  const oracleCallsP = [
    queryNominatim(lat, lon).catch((e) => ({ oracle: "nominatim", success: false, error: e.message })),
    queryBigDataCloud(lat, lon).catch((e) => ({ oracle: "bigdatacloud", success: false, error: e.message })),
    queryGeocodeMaps(lat, lon).catch((e) => ({ oracle: "geocode.maps.co", success: false, error: e.message })),
    queryOpenCage(lat, lon).catch((e) => ({ oracle: "opencage", success: false, error: e.message })),
  ];

  const results = await Promise.all(oracleCallsP);
  return results.filter(Boolean); // remove nulls (e.g., OpenCage skipped)
};

/**
 * Run multi-oracle consensus for a GPS coordinate.
 *
 * ALGORITHM:
 *   1. Query all 3 (or 4) oracles in parallel
 *   2. For each pair of successful results, compute distance between their
 *      returned coordinates
 *   3. If any 2+ pairs agree (distance ≤ 100m), mark "verified"
 *   4. If no pair agrees, mark "low_confidence"
 *
 * @param {number} lat
 * @param {number} lon
 * @param {string} typedLocation  The location the user claims (for mismatch check)
 * @returns {Promise<ConsensusResult>}
 */
const runConsensus = async (lat, lon, typedLocation = "") => {
  const startTime = Date.now();

  // Step 1: Query all oracles
  const allResults = await queryAllOracles(lat, lon);
  const successfulResults = allResults.filter((r) => r.success);

  // Step 2: Need at least 2 successful results for consensus
  if (successfulResults.length < 2) {
    return {
      consensus:     "no_data",
      confidence:    0,
      verified:      false,
      agreedLocation: null,
      oracleResults:  allResults,
      agreementPairs: [],
      message:       `Only ${successfulResults.length} oracle(s) responded. Cannot establish consensus.`,
      durationMs:    Date.now() - startTime,
    };
  }

  // Step 3: Check all pairs for agreement (within AGREEMENT_THRESHOLD_METERS)
  const agreementPairs = [];
  for (let i = 0; i < successfulResults.length; i++) {
    for (let j = i + 1; j < successfulResults.length; j++) {
      const r1 = successfulResults[i];
      const r2 = successfulResults[j];
      const dist = haversineDistance(r1.rawLat, r1.rawLon, r2.rawLat, r2.rawLon);

      if (dist <= AGREEMENT_THRESHOLD_METERS) {
        agreementPairs.push({
          oracles:     [r1.oracle, r2.oracle],
          distanceM:   Math.round(dist),
          location1:   r1.displayName,
          location2:   r2.displayName,
          agreedCity:  r1.city || r2.city,
          agreedState: r1.state || r2.state,
        });
      }
    }
  }

  // Step 4: Determine consensus outcome
  const verified     = agreementPairs.length >= 1; // at least 1 agreeing pair = 2+ oracles agree
  const confidence   = Math.min(100, Math.round((agreementPairs.length / (successfulResults.length * (successfulResults.length - 1) / 2)) * 100));
  const agreedPair   = agreementPairs[0]; // best agreement

  // Step 5: Build agreed location string
  const agreedLocation = agreedPair
    ? `${agreedPair.agreedCity}, ${agreedPair.agreedState}`.replace(/^, |, $/, "")
    : null;

  // Step 6: Check if typed location matches agreed location (fuzzy)
  let typedMatches = false;
  if (agreedLocation && typedLocation) {
    const agreed = agreedLocation.toLowerCase();
    const typed  = typedLocation.toLowerCase();
    typedMatches =
      agreed.includes(typed.split(",")[0].trim()) ||
      typed.includes(agreed.split(",")[0].trim());
  }

  return {
    consensus:      verified ? "verified" : "low_confidence",
    confidence,
    verified,
    agreedLocation,
    typedLocation,
    typedMatches,
    oracleResults:  allResults,
    agreementPairs,
    successCount:   successfulResults.length,
    failureCount:   allResults.length - successfulResults.length,
    thresholdM:     AGREEMENT_THRESHOLD_METERS,
    message:        verified
      ? `✅ ${agreementPairs.length} oracle pair(s) agree within ${AGREEMENT_THRESHOLD_METERS}m — location verified`
      : `⚠️ No oracle pair agrees within ${AGREEMENT_THRESHOLD_METERS}m — low confidence, flagged for admin review`,
    durationMs: Date.now() - startTime,
  };
};

module.exports = {
  runConsensus,
  queryNominatim,
  queryBigDataCloud,
  queryGeocodeMaps,
  haversineDistance,
  AGREEMENT_THRESHOLD_METERS,
};
