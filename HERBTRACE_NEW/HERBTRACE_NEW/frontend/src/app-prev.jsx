import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import SupplyChainPipeline from "./components/SupplyChainPipeline";
import SupplyChainStats from "./components/SupplyChainStats";
import "./App.css";

const SOCKET_URL = "http://localhost:5000";

function App() {
  const [connected, setConnected] = useState(false);
  const [batches, setBatches] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on("connect", () => {
      console.log("Connected to Digital Twin backend");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Digital Twin backend");
      setConnected(false);
    });

    // ========================================
    // INITIAL BLOCKCHAIN STATE
    // ========================================

    socket.on("initialState", (data) => {
      console.log(
        "Initial Digital Twin state:",
        data
      );

      setBatches(data.batches);

      const initialEvents = data.batches.map(
        (batch) => ({
          id: `initial-${batch.batchId}`,
          type: "Current Batch State",
          batchId: batch.batchId,
          details:
            batch.parents.length > 0
              ? `Parent: ${batch.parents.join(", ")}`
              : "No parent batch",
          status: batch.status,
          timestamp: new Date(
            batch.lastUpdated * 1000
          ).toLocaleTimeString(),
        })
      );

      setEvents(initialEvents);
    });

    // ========================================
    // BATCH CREATED
    // ========================================

    socket.on("batchCreated", (data) => {
      console.log("BatchCreated:", data);

      setBatches((previousBatches) => {
        const existing = previousBatches.find(
          (batch) =>
            batch.batchId === data.batchId
        );

        if (existing) {
          return previousBatches.map((batch) =>
            batch.batchId === data.batchId
              ? {
                  ...batch,
                  status: data.status,
                  currentOwner: data.farmer,
                  dataHash: data.dataHash,
                }
              : batch
          );
        }

        return [
          ...previousBatches,
          {
            batchId: data.batchId,
            status: data.status,
            currentOwner: data.farmer,
            dataHash: data.dataHash,
            parents: [],
            history: [],
          },
        ];
      });

      setEvents((previousEvents) => [
        {
          id: Date.now(),
          type: "Batch Created",
          batchId: data.batchId,
          details: `Created by ${data.farmer}`,
          status: data.status,
          timestamp:
            new Date().toLocaleTimeString(),
        },
        ...previousEvents,
      ]);
    });

    // ========================================
    // BATCH UPDATED
    // ========================================

    socket.on("batchUpdated", (data) => {
      console.log("BatchUpdated:", data);

      setBatches((previousBatches) =>
        previousBatches.map((batch) =>
          batch.batchId === data.batchId
            ? {
                ...batch,
                status: data.status,
                currentOwner: data.updatedBy,
                dataHash: data.dataHash,
              }
            : batch
        )
      );

      setEvents((previousEvents) => [
        {
          id: Date.now(),
          type: "Batch Updated",
          batchId: data.batchId,
          details: `Updated by ${data.updatedBy}`,
          status: data.status,
          timestamp:
            new Date().toLocaleTimeString(),
        },
        ...previousEvents,
      ]);
    });

    // ========================================
    // BATCH LINKED
    // ========================================

        socket.on("batchLinked", (data) => {
      console.log("BatchLinked:", data);

      setBatches((previousBatches) =>
        previousBatches.map((batch) =>
          batch.batchId === data.childBatchId
            ? {
                ...batch,
                parents: [
                  ...new Set([
                    ...(batch.parents || []),
                    data.parentBatchId,
                  ]),
                ],
              }
            : batch
        )
      );

      setEvents((previousEvents) => [
        {
          id: Date.now(),
          type: "Batch Linked",
          batchId: data.childBatchId,
          details: `Parent: ${data.parentBatchId}`,
          status: "Lineage Updated",
          timestamp:
            new Date().toLocaleTimeString(),
        },
        ...previousEvents,
      ]);
    });

    // ========================================
    // DELAYED BATCHES
    // ========================================

    socket.on("delayedBatches", (data) => {
      console.log("Delayed batches:", data);

      setBatches((previousBatches) =>
        previousBatches.map((batch) => {
          const delayedBatch = data.find(
            (item) => item.batchId === batch.batchId
          );

          return delayedBatch
            ? {
                ...batch,
                delayed: true,
                delaySeconds: delayedBatch.delaySeconds,
              }
            : batch;
        })
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="dashboard">
      <div className="dashboard-container">

        {/* HEADER */}

        <header className="dashboard-header">
          <div>
            <h1>🌿 HerbTrace Digital Twin</h1>

            <p>
              Real-time herbal supply chain
              traceability
            </p>
          </div>

          <div
            className={`live-indicator ${
              connected ? "online" : "offline"
            }`}
          >
            <span className="status-dot"></span>

            {connected
              ? "LIVE"
              : "OFFLINE"}
          </div>
        </header>

        {/* SYSTEM STATUS */}

        <section className="status-panel">

          <div className="status-card">
            <span>Backend</span>

            <strong>
              {connected
                ? "🟢 Connected"
                : "🔴 Disconnected"}
            </strong>
          </div>

          <div className="status-card">
            <span>Blockchain</span>

            <strong>
              🟢 Ethereum Sepolia
            </strong>
          </div>

          <div className="status-card">
            <span>Contract</span>

            <strong className="address">
              0xA474...BB78
            </strong>
          </div>

          <div className="status-card">
            <span>Total Batches</span>

            <strong>
              {batches.length}
            </strong>
          </div>

        </section>

        {/* SUPPLY CHAIN STATISTICS */}

<section className="dashboard-section stats-section">
  <div className="section-header">
    <div>
      <h2>Supply Chain Overview</h2>

      <p>
        Real-time batch distribution across supply chain stages
      </p>
    </div>
  </div>

  <SupplyChainStats batches={batches} />
</section>

        {/* SUPPLY CHAIN PIPELINE */}

        <section className="dashboard-section">

          <div className="section-header">
            <div>
              <h2>
                Supply Chain Pipeline
              </h2>

              <p>
                Live status of every tracked
                herbal batch
              </p>
            </div>
          </div>

          <SupplyChainPipeline
            batches={batches}
          />

        </section>

        {/* LIVE ACTIVITY */}

        <section className="dashboard-section">

          <div className="section-header">
            <div>
              <h2>
                Live Activity
              </h2>

              <p>
                Blockchain events received in
                real time
              </p>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              📡 Waiting for blockchain activity...
            </div>
          ) : (
            <div className="activity-list">

              {events.map((event) => (
                <div
                  className="activity-item"
                  key={event.id}
                >

                  <div className="activity-icon">

                    {event.type ===
                      "Batch Created" &&
                      "🌱"}

                    {event.type ===
                      "Batch Updated" &&
                      "🔄"}

                    {event.type ===
                      "Batch Linked" &&
                      "🔗"}

                    {event.type ===
                      "Current Batch State" &&
                      "📦"}

                  </div>

                  <div className="activity-content">

                    <div className="activity-top">

                      <strong>
                        {event.type}
                      </strong>

                      <span>
                        {event.timestamp}
                      </span>

                    </div>

                    <div className="activity-batch">
                      {event.batchId}
                    </div>

                    <div className="activity-details">
                      {event.details}
                    </div>

                  </div>

                  <div className="activity-status">
                    {event.status}
                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

      </div>
    </div>
  );
}

export default App;