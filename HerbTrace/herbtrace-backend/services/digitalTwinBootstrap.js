/**
 * digitalTwinBootstrap.js — Isolated bootstrap manager for Digital Twin subsystem.
 *
 * Coordinates:
 *   1. SQLite cache initialization (dbCache.js)
 *   2. Pre-warming OSRM routes (osrmService.js)
 *   3. Read-only historical blockchain sync (blockchainSync.js)
 *   4. Attaching live contract listeners (blockchainSync.js)
 *   5. Wiring Socket.IO client connections to send state:snapshot
 *
 * Completely non-blocking and isolated. Failure of any Digital Twin module will not crash
 * the underlying Express REST API server.
 */

const { initDb } = require("./dbCache");
const { prewarmRouteCache, getAllRoutes } = require("./osrmService");
const { runHistoricalSync, attachLiveListeners, buildSnapshot } = require("./blockchainSync");

async function digitalTwinBootstrap(io) {
  console.log("[DIGITAL TWIN] Initializing Digital Twin subsystem…");

  // 1. Initialize SQLite Cache
  try {
    initDb();
  } catch (err) {
    console.error("[DIGITAL TWIN] SQLite cache initialization failed:", err.message);
  }

  // 2. Pre-warm OSRM Route Cache (non-blocking)
  prewarmRouteCache().catch((err) => {
    console.warn("[DIGITAL TWIN] OSRM route pre-warm warning:", err.message);
  });

  // 3. Historical Blockchain Sync
  try {
    await runHistoricalSync(io);
  } catch (err) {
    console.error("[DIGITAL TWIN] Historical sync warning:", err.message);
  }

  // 4. Attach Live Contract Event Listeners
  try {
    attachLiveListeners(io);
  } catch (err) {
    console.error("[DIGITAL TWIN] Live event listeners warning:", err.message);
  }

  // 5. Socket.IO Connection Handler
  if (io) {
    io.on("connection", async (socket) => {
      console.log(`[SOCKET] Client connected to Digital Twin: ${socket.id}`);

      try {
        const allRoutes = await getAllRoutes();
        const snapshotBatches = buildSnapshot(allRoutes);

        socket.emit("state:snapshot", {
          batches: snapshotBatches,
          routes:  allRoutes,
        });

        console.log(`[SOCKET] Snapshot sent to ${socket.id}: ${snapshotBatches.length} batches.`);
      } catch (err) {
        console.error(`[SOCKET] Error generating snapshot for ${socket.id}:`, err.message);
        socket.emit("state:snapshot", { batches: [], routes: {} });
      }

      socket.on("disconnect", () => {
        console.log(`[SOCKET] Client disconnected from Digital Twin: ${socket.id}`);
      });
    });
  }

  console.log("[DIGITAL TWIN] Digital Twin subsystem successfully bootstrapped.");
}

module.exports = digitalTwinBootstrap;
