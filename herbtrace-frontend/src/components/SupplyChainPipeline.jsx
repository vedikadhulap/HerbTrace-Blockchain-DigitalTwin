/**
 * SupplyChainPipeline.jsx — Interactive visual batch pipeline.
 *
 * ZERO EMOJIS — Icons provided by lucide-react:
 *   Collected   — Sprout
 *   Tested      — FlaskConical
 *   Processed   — Settings2
 *   Packaged    — Package
 *   Distributed — Truck
 */

import { useState } from "react";
import {
  Sprout,
  FlaskConical,
  Settings2,
  Package,
  Truck,
  AlertTriangle,
  MapPin,
  Link2,
  CheckCircle2,
  Clock,
  Navigation,
} from "lucide-react";
import MapModal from "./MapModal";

const STAGES = [
  { key: "Collected",   label: "Collected",   role: "Farmer",      Icon: Sprout },
  { key: "Tested",      label: "Tested",      role: "Laboratory",  Icon: FlaskConical },
  { key: "Processed",   label: "Processed",   role: "Processor",   Icon: Settings2 },
  { key: "Packaged",    label: "Packaged",    role: "Processor",   Icon: Package },
  { key: "Distributed", label: "Distributed", role: "Distributor", Icon: Truck },
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
      <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
        <Sprout size={36} color="var(--sage)" style={{ marginBottom: 8 }} />
        <br />
        <strong style={{ color: "var(--forest)", fontSize: 14 }}>Waiting for Tracked Batches</strong>
        <p style={{ margin: "4px 0 0", fontSize: 11 }}>
          Real-time blockchain batch activity will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="dt-pipeline-container">
        {batches.map((batch) => {
          const completed = COMPLETED_STAGES[batch.status] || [];
          const delayed   = Boolean(batch.delayed);
          const batchLoc  = locationMap[batch.batchId];
          const isMoving  = batchLoc && !batchLoc.isStatic;

          return (
            <article
              key={batch.batchId}
              className={`dt-batch-card ${delayed ? "delayed" : ""}`}
            >
              <div className="dt-batch-header">
                <div className="dt-batch-title">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#edf3e9", display: "grid", placeItems: "center", color: "var(--forest)" }}>
                    <Sprout size={18} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3>{batch.batchId}</h3>
                      {delayed && (
                        <span className="dt-pill warning">
                          <AlertTriangle size={11} /> DELAYED
                        </span>
                      )}
                      {isMoving && (
                        <span className="dt-pill transit">
                          <Navigation size={11} /> In Transit
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      Owner: <strong>{shortenAddress(batch.currentOwner)}</strong>
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="dt-btn-map"
                    onClick={() => setMapBatchId(batch.batchId)}
                    title="View route map and timing"
                  >
                    <MapPin size={13} /> View on Map
                  </button>

                  <div className={`dt-pill ${delayed ? "warning" : "transit"}`}>
                    <CheckCircle2 size={11} />
                    {delayed ? "Attention Required" : batch.status}
                  </div>
                </div>
              </div>

              <div className="dt-journey">
                {STAGES.map((stage) => {
                  const isCompleted = completed.includes(stage.key);
                  const isCurrent   = batch.status === stage.key;
                  const StageIcon   = stage.Icon;

                  return (
                    <div
                      key={stage.key}
                      className={`dt-stage ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                    >
                      <div className="dt-stage-icon">
                        <StageIcon size={16} />
                      </div>

                      <div className="dt-stage-info">
                        <strong>{stage.label}</strong>
                        <span>{stage.role}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {batch.parents && batch.parents.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                  <Link2 size={13} color="var(--gold)" />
                  Derived from parents: <strong style={{ color: "var(--forest)" }}>{batch.parents.join(", ")}</strong>
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
