/**
 * server.js — HerbTrace Backend
 *
 * Upgraded from plain Express to Express + Socket.IO for the Digital Twin layer.
 * Existing REST API routes are completely unchanged.
 *
 * Startup sequence:
 *   1. Connect to MongoDB (existing)
 *   2. Init SQLite cache (Digital Twin)
 *   3. Pre-warm OSRM route cache (Digital Twin)
 *   4. Run historical blockchain sync (Digital Twin)
 *   5. Attach live contract event listeners (Digital Twin)
 *   6. Start HTTP+Socket.IO server
 *
 * Socket.IO events emitted:
 *   state:snapshot  — sent to each new client on connect
 *   batch:updated   — live blockchain event (triggers animation on client)
 *   batch:location  — simulated GPS waypoint (from locationSimulator)
 */

const express = require("express");
const http    = require("http");
const cors    = require("cors");
const path    = require("path");
require("dotenv").config();

const { Server } = require("socket.io");
const connectDB  = require("./config/db");

// ─── Digital Twin services ────────────────────────────────────────────────────
const { initDb }              = require("./services/dbCache");
const { prewarmRouteCache, getAllRoutes } = require("./services/osrmService");
const { runHistoricalSync, attachLiveListeners, buildSnapshot } = require("./services/blockchainSync");

// ─── Express app + HTTP server ────────────────────────────────────────────────

const app        = express();
const httpServer = http.createServer(app);

// ─── Socket.IO setup ──────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);
global.io = io;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Existing REST routes (untouched) ─────────────────────────────────────────

const authRoutes  = require("./routes/authRoutes");
const batchRoutes = require("./routes/batchRoutes");

app.use("/auth",  authRoutes);
app.use("/batch", batchRoutes);

app.get("/", (req, res) => {
  res.send("HerbTrace Backend is Running");
});

// ─── Socket.IO: send snapshot on each new client connection ──────────────────

io.on("connection", async (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  try {
    const allRoutes = await getAllRoutes();
    const snapshotBatches = buildSnapshot(allRoutes);

    socket.emit("state:snapshot", {
      batches: snapshotBatches,
      routes:  allRoutes,
    });

    console.log(`[SOCKET] Snapshot sent to ${socket.id}: ${snapshotBatches.length} batches.`);
  } catch (err) {
    console.error(`[SOCKET] Failed to build snapshot for ${socket.id}:`, err.message);
    socket.emit("state:snapshot", { batches: [], routes: {} });
  }

  socket.on("disconnect", () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function startServer() {
  // 1. MongoDB (existing)
  try {
    await connectDB();
  } catch (err) {
    console.warn("[SERVER] MongoDB unavailable:", err.message);
    console.warn("[SERVER] REST API routes will fail; Digital Twin Socket.IO layer will still start.");
  }

  // 2. SQLite cache
  try {
    initDb();
  } catch (err) {
    console.warn("[SERVER] SQLite init error:", err.message);
  }

  // 3. OSRM route pre-warm (non-blocking)
  prewarmRouteCache().catch((err) =>
    console.error("[OSRM] Pre-warm error:", err.message)
  );

  // 4. Historical blockchain sync & live listeners (non-blocking)
  runHistoricalSync(io)
    .then(() => {
      try {
        attachLiveListeners(io);
      } catch (err) {
        console.error("[SYNC] Attach live listeners failed:", err.message);
      }
    })
    .catch((err) => {
      console.error("[SYNC] Historical sync failed:", err.message);
      console.error("[SYNC] Live events will still be captured.");
      try {
        attachLiveListeners(io);
      } catch (e) {
        console.error("[SYNC] Attach live listeners failed:", e.message);
      }
    });

  // 5. Listen
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`[SERVER] HerbTrace backend running on port ${PORT}`);
    console.log(`[SERVER] Socket.IO active. Waiting for client connections…`);
  });
}

startServer().catch((err) => {
  console.error("[SERVER] Fatal startup error:", err);
  process.exit(1);
});