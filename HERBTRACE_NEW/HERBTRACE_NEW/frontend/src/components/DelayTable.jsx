/**
 * DelayTable.jsx — Per-leg timing breakdown for a batch (Phase 3).
 *
 * Props:
 *   delayLegs — array from delayService.formatLegsForEmission()
 *     Each item: { key, label, osrmExpected, allowed, elapsed, status, isFallback }
 *
 * Status colour coding:
 *   Pending    — grey
 *   In Transit — blue
 *   On Time    — green
 *   Delayed    — orange/amber
 *   Late       — red
 */

const STATUS_STYLES = {
  Pending:    { bg: "#f1f5f9", text: "#64748b", icon: "⬜" },
  "In Transit": { bg: "#eff6ff", text: "#3b82f6", icon: "🚛" },
  Delayed:    { bg: "#fff7ed", text: "#f97316", icon: "⚠️" },
  "On Time":  { bg: "#f0fdf4", text: "#22c55e", icon: "✅" },
  Late:       { bg: "#fef2f2", text: "#ef4444", icon: "🔴" },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES["Pending"];
  return (
    <span
      style={{
        background:   style.bg,
        color:        style.text,
        padding:      "2px 10px",
        borderRadius: 12,
        fontWeight:   600,
        fontSize:     "0.78rem",
        whiteSpace:   "nowrap",
      }}
    >
      {style.icon} {status}
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
      <table className="delay-table">
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
                <span className="leg-label">{leg.label}</span>
                {leg.isFallback && (
                  <span
                    title="Straight-line estimate — OSRM unavailable"
                    style={{ marginLeft: 4, fontSize: "0.7rem", color: "#f97316" }}
                  >
                    ⚠️est.
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
