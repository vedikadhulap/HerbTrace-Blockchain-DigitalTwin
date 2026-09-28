/**
 * locationSimulator.js — Software-simulated GPS motion along OSRM routes.
 *
 * When a batch transitions to a new stage:
 *   1. Load the OSRM polyline for the leg (from SQLite cache)
 *   2. Use setInterval to stream intermediate coordinates along the polyline
 *      via Socket.IO event 'batch:location'
 *   3. Compress real route duration by SIM_SPEED_FACTOR (default 60×)
 *
 * OSRM coordinates are [lng, lat] per GeoJSON spec.
 * Socket.IO emits use { lat, lng } for Leaflet compatibility.
 *
 * Logging prefix: [SIM]
 */

const { getRouteCache } = require("./dbCache");
const { LEGS, FACILITIES } = require("./facilityRegistry");
require("dotenv").config();

const SIM_SPEED_FACTOR = parseFloat(process.env.SIM_SPEED_FACTOR) || 60;

const activeSimulations = new Map();

function interpolatePolyline(coordinates, progress) {
  if (!coordinates || coordinates.length === 0) return null;
  if (progress <= 0) return coordinates[0];
  if (progress >= 1) return coordinates[coordinates.length - 1];

  const distances = [0];
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    const d = Math.sqrt((lng2 - lng1) ** 2 + (lat2 - lat1) ** 2);
    distances.push(distances[i - 1] + d);
  }
  const totalDist = distances[distances.length - 1];
  const targetDist = progress * totalDist;

  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDist) {
      const segStart = distances[i - 1];
      const segEnd   = distances[i];
      const segLen   = segEnd - segStart;
      const t = segLen === 0 ? 0 : (targetDist - segStart) / segLen;
      const [lng1, lat1] = coordinates[i - 1];
      const [lng2, lat2] = coordinates[i];
      return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
    }
  }

  return coordinates[coordinates.length - 1];
}

function startSimulation({ batchId, legKey, io, startProgress = 0 }) {
  stopSimulation(batchId);

  const routeData = getRouteCache(legKey);
  if (!routeData || !routeData.geometry || !routeData.geometry.coordinates) {
    console.warn(`[SIM] No route data for leg ${legKey} — cannot simulate batch ${batchId}`);
    return;
  }

  const coordinates = routeData.geometry.coordinates;
  const realDurationSeconds = routeData.durationSeconds;
  const simDurationMs = (realDurationSeconds / SIM_SPEED_FACTOR) * 1000;

  const NUM_STEPS = Math.max(50, Math.min(200, Math.round(simDurationMs / 200)));
  const intervalMs = Math.max(200, simDurationMs / NUM_STEPS);

  let step = Math.round(startProgress * NUM_STEPS);
  const totalSteps = NUM_STEPS;

  console.log(
    `[SIM] Starting simulation for batch ${batchId} on ${legKey}. ` +
    `Real: ${Math.round(realDurationSeconds / 60)} min → Sim: ${Math.round(simDurationMs / 1000)}s ` +
    `(×${SIM_SPEED_FACTOR}), ${totalSteps} steps @ ${Math.round(intervalMs)}ms each.`
  );

  const intervalId = setInterval(() => {
    step++;
    const progress = Math.min(step / totalSteps, 1.0);
    const [lng, lat] = interpolatePolyline(coordinates, progress);

    io.emit("batch:location", {
      batchId,
      lat,
      lng,
      progress,
      legKey,
      isFallback: routeData.isFallback,
    });

    if (progress >= 1.0) {
      console.log(`[SIM] Simulation complete for batch ${batchId} on ${legKey}.`);
      stopSimulation(batchId);
    }
  }, intervalMs);

  activeSimulations.set(batchId, { intervalId, legKey });
}

function stopSimulation(batchId) {
  if (activeSimulations.has(batchId)) {
    const { intervalId } = activeSimulations.get(batchId);
    clearInterval(intervalId);
    activeSimulations.delete(batchId);
    console.log(`[SIM] Stopped simulation for batch ${batchId}.`);
  }
}

function stopAllSimulations() {
  console.log(`[SIM] Stopping all ${activeSimulations.size} active simulations…`);
  for (const [batchId, { intervalId }] of activeSimulations.entries()) {
    clearInterval(intervalId);
    console.log(`[SIM] Stopped simulation for batch ${batchId}.`);
  }
  activeSimulations.clear();
}

function getStaticPosition(currentStatus) {
  const facility = FACILITIES[currentStatus];
  if (!facility) return null;
  return { lat: facility.lat, lng: facility.lng };
}

function getLegForTransition(fromStatus, toStatus) {
  const leg = LEGS.find((l) => l.from === fromStatus && l.to === toStatus);
  return leg ? leg.key : null;
}

process.on("SIGTERM", stopAllSimulations);
process.on("SIGINT",  stopAllSimulations);

module.exports = {
  startSimulation,
  stopSimulation,
  stopAllSimulations,
  getStaticPosition,
  getLegForTransition,
};
