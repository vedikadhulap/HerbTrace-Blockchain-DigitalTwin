import { useState } from "react";
import MapModal from "./MapModal";

const STAGES = [
  { key: "Collected", label: "Collected", role: "Farmer", icon: "🌱" },
  { key: "Tested", label: "Tested", role: "Laboratory", icon: "🔬" },
  { key: "Processed", label: "Processed", role: "Processor", icon: "⚙️" },
  { key: "Packaged", label: "Packaged", role: "Processor", icon: "📦" },
  { key: "Distributed", label: "Distributed", role: "Distributor", icon: "🚚" },
];

const COMPLETED_STAGES = {
  Collected:   ["Collected"],
  Tested:      ["Collected", "Tested"],
  Processed:   ["Collected", "Tested", "Processed"],
  Packaged:    ["Collected", "Tested", "Processed", "Packaged"],
  Distributed: ["Collected", "Tested", "Processed", "Distributed"],
};

function shortenAddress(address) {
  if (!address) return "Unknown owner";
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function SupplyChainPipeline({ batches, locationMap = {}, routes = {} }) {
  const [mapBatchId, setMapBatchId] = useState(null);

  const mapBatch = mapBatchId
    ? batches.find((b) => b.batchId === mapBatchId)
    : null;

  if (!batches || batches.length === 0) {
    return (
      <div className="pipeline-empty">
        <div className="pipeline-empty-icon">🌿</div>
        <strong>Waiting for tracked batches</strong>
        <span>Blockchain batch activity will appear here.</span>
      </div>
    );
  }

  return (
    <>
      <div className="pipeline-container">
        {batches.map((batch) => {
          const completed = COMPLETED_STAGES[batch.status] || [];
          const delayed   = Boolean(batch.delayed);
          const batchLoc  = locationMap[batch.batchId];
          const isMoving  = batchLoc && !batchLoc.isStatic;

          return (
            <article
              className={`batch-pipeline ${delayed ? "batch-delayed" : ""} ${
                batch.isLive ? "batch-live" : ""
              }`}
              key={batch.batchId}
            >
              <div className="batch-pipeline-header">
                <div className="batch-identity">
                  <div className="batch-seed">🌿</div>
                  <div>
                    <div className="batch-title-row">
                      <h3>{batch.batchId}</h3>
                      {delayed && <span className="delay-pill">⚠️ DELAYED</span>}
                      {isMoving && <span className="transit-pill">🚛 In Transit</span>}
                    </div>
                    <span className="batch-owner">
                      Owner <strong>{shortenAddress(batch.currentOwner)}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    className="btn-map"
                    onClick={() => setMapBatchId(batch.batchId)}
                    title="View route map and timing"
                  >
                    📍 Map
                  </button>

                  <div className={`batch-status-pill ${delayed ? "delayed" : ""}`}>
                    <span />
                    {delayed ? "Attention required" : batch.status}
                  </div>
                </div>
              </div>

              <div className="journey">
                <div className="journey-stages">
                  {STAGES.map((stage) => {
                    const isCompleted = completed.includes(stage.key);
                    const isCurrent   = batch.status === stage.key;
                    const isSkipped   = batch.status === "Distributed" && stage.key === "Packaged";

                    return (
                      <div
                        className={`journey-stage ${isCompleted ? "completed" : ""} ${
                          isCurrent ? "current" : ""
                        } ${isSkipped ? "skipped" : ""}`}
                        key={stage.key}
                      >
                        <div className="journey-node">
                          {stage.icon}
                          {isCurrent && <span className="node-pulse" />}
                        </div>
                        <div className="journey-label">
                          <strong>{stage.label}</strong>
                          <span>{stage.role}</span>
                          <small>
                            {isSkipped
                              ? "Not recorded"
                              : isCurrent
                              ? delayed
                                ? "Delayed"
                                : "Current"
                              : isCompleted
                              ? "Completed"
                              : "Pending"}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {delayed && (
                <div className="delay-banner">
                  <div className="delay-banner-icon">⚠️</div>
                  <div>
                    <strong>Batch requires attention</strong>
                    <span>
                      {batch.status} stage has exceeded its monitoring threshold.{" "}
                      <button
                        className="btn-link"
                        onClick={() => setMapBatchId(batch.batchId)}
                      >
                        View timing details →
                      </button>
                    </span>
                  </div>
                </div>
              )}

              {batch.parents && batch.parents.length > 0 && (
                <div className="batch-lineage">
                  <span className="lineage-icon">🔗</span>
                  <span>Derived from </span>
                  <strong>{batch.parents.join(", ")}</strong>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {mapBatch && (
        <MapModal
          batch={mapBatch}
          locationMap={locationMap}
          routes={routes}
          onClose={() => setMapBatchId(null)}
        />
      )}
    </>
  );
}

export default SupplyChainPipeline;
