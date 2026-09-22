import { useEffect, useMemo, useState, useRef } from "react";
import { io } from "socket.io-client";
import SupplyChainPipeline from "./components/SupplyChainPipeline";
import SupplyChainStats from "./components/SupplyChainStats";
import "./App.css";

const SOCKET_URL = "http://localhost:5000";

function App() {
  const [connected, setConnected]   = useState(false);
  const [batches, setBatches]       = useState([]);
  const [events, setEvents]         = useState([]);
  // Map: batchId → { lat, lng, legKey, progress }  — updated by batch:location
  const [locationMap, setLocationMap] = useState({});
  // Map: legKey → { geometry, durationSeconds, isFallback } — received in snapshot
  const [routes, setRoutes]           = useState({});

  // Keep a ref to routes so live batch:location handler can read the latest value
  const routesRef = useRef({});
  useEffect(() => { routesRef.current = routes; }, [routes]);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to Digital Twin backend");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] Disconnected from Digital Twin backend");
      setConnected(false);
    });

    // ── Phase 1: state:snapshot ──────────────────────────────────────────────
    // Replaces the old "initialState" event.
    // Batches from the snapshot are marked isLive=false — no animations.
    socket.on("state:snapshot", (data) => {
      const snapshotBatches = data.batches || [];
      const snapshotRoutes  = data.routes  || {};

      setBatches(snapshotBatches);
      setRoutes(snapshotRoutes);

      // Build initial location map from static facility positions in snapshot
      const initLoc = {};
      for (const b of snapshotBatches) {
        if (b.currentLat != null && b.currentLng != null) {
          initLoc[b.batchId] = {
            lat:      b.currentLat,
            lng:      b.currentLng,
            legKey:   null,
            progress: null,
            isStatic: true,
          };
        }
      }
      setLocationMap(initLoc);

      // Populate the activity feed with snapshot entries (no animation class)
      const snapshotEvents = snapshotBatches.map((batch) => ({
        id:        `snapshot-${batch.batchId}`,
        type:      "Current State",
        batchId:   batch.batchId,
        details:
          batch.parents?.length > 0
            ? `Parent: ${batch.parents.join(", ")}`
            : "Blockchain state synchronized",
        status:    batch.status,
        timestamp: batch.lastUpdated
          ? new Date(batch.lastUpdated * 1000).toLocaleTimeString()
          : "—",
      }));

      setEvents(snapshotEvents);
      console.log(`[SOCKET] Snapshot received: ${snapshotBatches.length} batches.`);
    });

    // ── Phase 1: batch:updated ───────────────────────────────────────────────
    // Replaces both old "batchCreated" and "batchUpdated" events.
    // Carries: batchId, status, currentOwner, dataHash, parents, delayed,
    //          delayLegs, currentLat, currentLng, isLive=true
    socket.on("batch:updated", (data) => {
      setBatches((prev) => {
        const exists = prev.some((b) => b.batchId === data.batchId);
        if (exists) {
          return prev.map((b) =>
            b.batchId === data.batchId
              ? {
                  ...b,
                  status:       data.status,
                  currentOwner: data.currentOwner,
                  dataHash:     data.dataHash,
                  parents:      data.parents   || b.parents,
                  delayed:      data.delayed   || false,
                  delayLegs:    data.delayLegs || [],
                  isLive:       true,
                }
              : b
          );
        }
        // New batch not yet in state
        return [
          ...prev,
          {
            batchId:      data.batchId,
            status:       data.status,
            currentOwner: data.currentOwner,
            dataHash:     data.dataHash,
            parents:      data.parents   || [],
            delayed:      data.delayed   || false,
            delayLegs:    data.delayLegs || [],
            isLive:       true,
          },
        ];
      });

      setEvents((prev) => [
        {
          id:        Date.now(),
          type:      "Batch Updated",
          batchId:   data.batchId,
          details:   `Stage → ${data.status}`,
          status:    data.status,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    });

    // ── Phase 2: batch:location ──────────────────────────────────────────────
    // Streaming waypoints from locationSimulator.
    // { batchId, lat, lng, progress, legKey, isFallback }
    socket.on("batch:location", (data) => {
      setLocationMap((prev) => ({
        ...prev,
        [data.batchId]: {
          lat:        data.lat,
          lng:        data.lng,
          legKey:     data.legKey,
          progress:   data.progress,
          isFallback: data.isFallback,
          isStatic:   false,
        },
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // ── Derived counts ───────────────────────────────────────────────────────

  const delayedCount = useMemo(
    () => batches.filter((b) => b.delayed).length,
    [batches]
  );

  const activeCount = useMemo(
    () => batches.filter((b) => b.status !== "Distributed").length,
    [batches]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🌿</div>

          <div>
            <h1>HerbTrace</h1>
            <span>Digital Twin · Supply Chain Intelligence</span>
          </div>
        </div>

        <div className="network-status">
          <span
            className={`network-dot ${
              connected ? "online" : "offline"
            }`}
          />

          <div>
            <strong>
              {connected
                ? "LIVE MONITORING"
                : "OFFLINE"}
            </strong>

            <span>
              Ethereum Sepolia · 0xA474...BB78
            </span>
          </div>
        </div>
      </header>

      <main className="dashboard-main">

        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">
              AYURVEDIC SUPPLY CHAIN
            </span>

            <h2>
              From herb collection
              <br />
              to trusted delivery.
            </h2>

            <p>
              A live digital representation of every
              tracked herbal batch, synchronized with
              blockchain events.
            </p>

            <div className="hero-status">
              <span className="pulse" />
              Blockchain monitoring active
            </div>
          </div>

          <div className="hero-illustration">
            <div className="herb-orbit orbit-one" />
            <div className="herb-orbit orbit-two" />

            <div className="floating-herb herb-one">
              🌿
            </div>

            <div className="floating-herb herb-two">
              🍃
            </div>

            <div className="hero-leaf">
              🌿
            </div>

            <div className="hero-path">
              <span>COLLECT</span>
              <span>TEST</span>
              <span>PROCESS</span>
              <span>PACK</span>
              <span>DELIVER</span>
            </div>
          </div>
        </section>

        <section className="metrics-grid">
          <div className="metric-card">
            <span className="metric-icon">📦</span>
            <div>
              <span>Total Batches</span>
              <strong>{batches.length}</strong>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">⚡</span>
            <div>
              <span>Active Batches</span>
              <strong>{activeCount}</strong>
            </div>
          </div>

          <div className="metric-card warning">
            <span className="metric-icon">⚠️</span>
            <div>
              <span>Delayed Batches</span>
              <strong>{delayedCount}</strong>
            </div>
          </div>

          <div className="metric-card success">
            <span className="metric-icon">🚚</span>
            <div>
              <span>Distributed</span>
              <strong>
                {
                  batches.filter(
                    (b) => b.status === "Distributed"
                  ).length
                }
              </strong>
            </div>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="section-title">
            <div>
              <span className="section-kicker">
                LIVE SUPPLY CHAIN
              </span>

              <h3>Batch Journey</h3>

              <p>
                Real-time movement of herbal batches
                across the supply chain.
              </p>
            </div>

            <div className="live-badge">
              <span />
              LIVE
            </div>
          </div>

          {/* Pass locationMap and routes so pipeline can render "View on Map" */}
          <SupplyChainPipeline
            batches={batches}
            locationMap={locationMap}
            routes={routes}
          />
        </section>

        <section className="lower-grid">

          <div className="dashboard-card">
            <div className="section-title compact">
              <div>
                <span className="section-kicker">
                  OVERVIEW
                </span>

                <h3>Supply Chain Health</h3>
              </div>
            </div>

            <SupplyChainStats batches={batches} />
          </div>

          <div className="dashboard-card activity-card">
            <div className="section-title compact">
              <div>
                <span className="section-kicker">
                  BLOCKCHAIN FEED
                </span>

                <h3>Live Activity</h3>
              </div>
            </div>

            <div className="activity-feed">
              {events.length === 0 ? (
                <div className="empty-feed">
                  Waiting for blockchain activity...
                </div>
              ) : (
                events.slice(0, 5).map((event) => (
                  <div
                    className="activity-row"
                    key={event.id}
                  >
                    <div className="activity-marker">
                      {event.type === "Delay Alert"
                        ? "⚠️"
                        : event.type ===
                          "Batch Updated"
                        ? "↻"
                        : event.type ===
                          "Lineage Updated"
                        ? "🔗"
                        : "🌱"}
                    </div>

                    <div className="activity-info">
                      <strong>
                        {event.type}
                      </strong>

                      <span>
                        {event.batchId}
                      </span>

                      <small>
                        {event.details}
                      </small>
                    </div>

                    <time>
                      {event.timestamp}
                    </time>
                  </div>
                ))
              )}
            </div>
          </div>

        </section>

      </main>

      <footer className="dashboard-footer">
        <span>
          🌿 HerbTrace Digital Twin
        </span>

        <span>
          Real-time blockchain synchronization
        </span>
      </footer>
    </div>
  );
}

export default App;