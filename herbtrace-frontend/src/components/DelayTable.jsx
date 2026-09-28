/**
 * DelayTable.jsx — Per-leg timing breakdown for a batch.
 *
 * Icons used from lucide-react (ZERO EMOJIS):
 *   Pending    — Square
 *   In Transit — Truck
 *   On Time    — CheckCircle2
 *   Delayed    — AlertTriangle
 *   Late       — AlertCircle
 */

import { Square, Truck, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";

const STATUS_CONFIG = {
  Pending:      { bg: "#f1f5f9", text: "#64748b", Icon: Square },
  "In Transit": { bg: "#eff6ff", text: "#3b82f6", Icon: Truck },
  Delayed:      { bg: "#fff7ed", text: "#f97316", Icon: AlertTriangle },
  "On Time":    { bg: "#f0fdf4", text: "#22c55e", Icon: CheckCircle2 },
  Late:         { bg: "#fef2f2", text: "#ef4444", Icon: AlertCircle },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Pending"];
  const IconComponent = cfg.Icon;

  return (
    <span
      style={{
        background:   cfg.bg,
        color:        cfg.text,
        padding:      "3px 10px",
        borderRadius: 12,
        fontWeight:   600,
        fontSize:     "0.78rem",
        display:      "inline-flex",
        alignItems:   "center",
        gap:          "5px",
        whiteSpace:   "nowrap",
      }}
    >
      <IconComponent size={14} /> {status}
    </span>
  );
}

function DelayTable({ delayLegs }) {
  if (!delayLegs || delayLegs.length === 0) {
    return (
      <p style={{ color: "#94a3b8", textAlign: "center", padding: "1rem 0" }}>
        No timing data available yet.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="dt-delay-table">
        <thead>
          <tr>
            <th>Leg</th>
            <th>OSRM Expected</th>
            <th>Allowed (with buffer)</th>
            <th>Actual Elapsed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {delayLegs.map((leg) => (
            <tr
              key={leg.key}
              className={
                leg.status === "Delayed" || leg.status === "Late"
                  ? "delay-row-alert"
                  : ""
              }
            >
              <td>
                <strong style={{ color: "var(--forest)" }}>{leg.label}</strong>
                {leg.isFallback && (
                  <span
                    title="Straight-line estimate — OSRM unavailable"
                    style={{ marginLeft: 6, fontSize: "0.7rem", color: "#f97316" }}
                  >
                    (Est.)
                  </span>
                )}
              </td>
              <td>{leg.osrmExpected ?? "—"}</td>
              <td>{leg.allowed     ?? "—"}</td>
              <td>
                <strong
                  style={{
                    color:
                      leg.status === "Delayed" || leg.status === "Late"
                        ? "#ef4444"
                        : "inherit",
                  }}
                >
                  {leg.elapsed ?? "—"}
                </strong>
              </td>
              <td>
                <StatusBadge status={leg.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DelayTable;
