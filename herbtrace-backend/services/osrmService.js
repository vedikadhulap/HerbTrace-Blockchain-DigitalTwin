/**
 * osrmService.js — OSRM route fetching, caching, and fallback.
 *
 * Fetches driving routes between supply chain facility pairs using the public
 * OSRM API. Results are cached in SQLite (keyed by leg) to avoid repeated
 * requests.
 *
 * IMPORTANT coordinate order:
 *   OSRM API expects: {lng},{lat}  (longitude first)
 *   Leaflet expects:  [lat, lng]   (latitude first)
 *   This module always stores GeoJSON as OSRM returns it ([lng, lat] pairs in
 *   geometry.coordinates), and the frontend converts to Leaflet format.
 *
 * Fallback: if OSRM is unreachable, returns a straight-line GeoJSON and a
 * haversine-based duration estimate. Flagged with isFallback: true.
 *
 * Logging prefix: [OSRM]
 */

const { FACILITIES, LEGS } = require("./facilityRegistry");
const { upsertRouteCache, getRouteCache } = require("./dbCache");
require("dotenv").config();

const OSRM_BASE = "http://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 8000; // 8 seconds

// ─── Haversine distance (metres) ─────────────────────────────────────────────

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate transit duration from straight-line distance.
 * Assumes average 50 km/h driving speed.
 */
function estimateDurationSeconds(distMetres) {
  const speedMps = 50000 / 3600; // 50 km/h in m/s
  return Math.round(distMetres / speedMps);
}

// ─── Straight-line fallback geometry ─────────────────────────────────────────

function buildFallbackGeometry(fromFacility, toFacility) {
  return {
    type: "LineString",
    coordinates: [
      [fromFacility.lng, fromFacility.lat],
      [toFacility.lng,   toFacility.lat],
    ],
  };
}

// ─── OSRM fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch a route from the public OSRM API.
 */
async function fetchOSRMRoute(fromFacility, toFacility) {
  const coords = `${fromFacility.lng},${fromFacility.lat};${toFacility.lng},${toFacility.lat}`;
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    console.log(`[OSRM] Fetching route: ${fromFacility.name} → ${toFacility.name}`);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error(`OSRM returned code: ${data.code}`);
    }

    const route = data.routes[0];
    return {
      geometry: route.geometry,
      durationSeconds: Math.round(route.duration),
      isFallback: false,
    };
  } catch (err) {
    clearTimeout(timer);
    const distMetres = haversineMetres(
      fromFacility.lat, fromFacility.lng,
      toFacility.lat,   toFacility.lng
    );
    const durationSeconds = estimateDurationSeconds(distMetres);
    console.warn(
      `[OSRM] Failed for ${fromFacility.name} → ${toFacility.name}: ${err.message}. ` +
      `Using straight-line fallback (haversine: ${Math.round(distMetres / 1000)} km, ~${Math.round(durationSeconds / 60)} min).`
    );
    return {
      geometry: buildFallbackGeometry(fromFacility, toFacility),
      durationSeconds,
      isFallback: true,
    };
  }
}

// ─── Public API: get route with caching ──────────────────────────────────────

async function getRoute(legKey) {
  const cached = getRouteCache(legKey);
  if (cached) {
    return cached;
  }

  const leg = LEGS.find((l) => l.key === legKey);
  if (!leg) throw new Error(`[OSRM] Unknown leg key: ${legKey}`);

  const fromFacility = FACILITIES[leg.from];
  const toFacility   = FACILITIES[leg.to];
  if (!fromFacility || !toFacility) {
    throw new Error(`[OSRM] Unknown facility: ${leg.from} or ${leg.to}`);
  }

  const result = await fetchOSRMRoute(fromFacility, toFacility);

  upsertRouteCache({
    leg: legKey,
    geometry: result.geometry,
    durationSeconds: result.durationSeconds,
    isFallback: result.isFallback,
  });
  console.log(
    `[OSRM] Cached route for ${leg.label}: ${Math.round(result.durationSeconds / 60)} min, fallback=${result.isFallback}`
  );

  return result;
}

async function prewarmRouteCache() {
  console.log("[OSRM] Pre-warming route cache for all legs…");
  for (const leg of LEGS) {
    try {
      await getRoute(leg.key);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`[OSRM] prewarm failed for ${leg.key}: ${err.message}`);
    }
  }
  console.log("[OSRM] Route cache pre-warm complete.");
}

function getLegKeyForTransition(fromStatus, toStatus) {
  const leg = LEGS.find((l) => l.from === fromStatus && l.to === toStatus);
  return leg ? leg.key : null;
}

async function getAllRoutes() {
  const result = {};
  for (const leg of LEGS) {
    try {
      result[leg.key] = await getRoute(leg.key);
    } catch (err) {
      console.error(`[OSRM] getAllRoutes failed for ${leg.key}: ${err.message}`);
    }
  }
  return result;
}

module.exports = {
  getRoute,
  prewarmRouteCache,
  getAllRoutes,
  getLegKeyForTransition,
  LEGS,
};
