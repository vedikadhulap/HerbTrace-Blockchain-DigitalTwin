import { useEffect, useMemo, useState, useRef } from "react";
import { io } from "socket.io-client";
import SupplyChainPipeline from "../components/SupplyChainPipeline";
import SupplyChainStats from "../components/SupplyChainStats";
import "../components/DigitalTwin.css";

const SOCKET_URL = "http://localhost:5000";

function DigitalTwinDashboard() {
  const [connected, setConnected]     = useState(false);
  const [batches, setBatches]         = useState([]);
  const [events, setEvents]           = useState([]);
  const [locationMap, setLocationMap] = useState({});
  const [routes, setRoutes]           = useState({});

  const routesRef = useRef({});
  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to Digital Twin backend");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] Disconnected from Digital Twin backend");
      setConnected(false);
    });

    socket.on("state:snapshot", (data) => {
      const snapshotBatches = data.batches || [];
      const snapshotRoutes  = data.routes  || {};

      setBatches(snapshotBatches);
      setRoutes(snapshotRoutes);

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
    });

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

  const delayedCount = useMemo(
    () => batches.filter((b) => b.delayed).length,
    [batches]
  );

  const activeCount = useMemo(
    () => batches.filter((b) => b.status !== "Distributed").length,
    [batches]
  );

  return (
    <div className="dt-container">
      <div className="dt-header">
        <div className="dt-brand">
          <div className="dt-brand-mark">🌿</div>
          <div>
            <h2>Digital Twin Dashboard</h2>
            <span>Real-time Physical-to-Digital Supply Chain Intelligence</span>
          </div>
        </div>

        <div className="network-status">
          <span className={`network-dot ${connected ? "online" : "offline"}`} />
          <div>
            <strong>{connected ? "LIVE MONITORING" : "OFFLINE"}</strong>
            <span>Ethereum Blockchain Event Sync</span>
          </div>
        </div>
      </div>

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
            <strong>{batches.filter((b) => b.status === "Distributed").length}</strong>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="section-title">
          <div>
            <span className="section-kicker">LIVE SUPPLY CHAIN</span>
            <h3>Batch Journey & Transit Pipeline</h3>
            <p>Real-time physical observation of herbal batches synced with on-chain events.</p>
          </div>
          <div className="live-badge">
            <span />
            LIVE
          </div>
        </div>

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
              <span className="section-kicker">OVERVIEW</span>
              <h3>Supply Chain Health</h3>
            </div>
          </div>
          <SupplyChainStats batches={batches} />
        </div>

        <div className="dashboard-card activity-card">
          <div className="section-title compact">
            <div>
              <span className="section-kicker">BLOCKCHAIN FEED</span>
              <h3>Live Activity Feed</h3>
            </div>
          </div>

          <div className="activity-feed">
            {events.length === 0 ? (
              <div className="empty-feed">Waiting for blockchain activity...</div>
            ) : (
              events.slice(0, 6).map((event) => (
                <div className="activity-row" key={event.id}>
                  <div className="activity-marker">
                    {event.type === "Delay Alert"
                      ? "⚠️"
                      : event.type === "Batch Updated"
                      ? "↻"
                      : "🌱"}
                  </div>
                  <div className="activity-info">
                    <strong>{event.type}</strong>
                    <span>{event.batchId}</span>
                    <small>{event.details}</small>
                  </div>
                  <time>{event.timestamp}</time>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default DigitalTwinDashboard;
