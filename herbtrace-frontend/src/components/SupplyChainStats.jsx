/**
 * SupplyChainStats.jsx — Supply Chain Health & Stage Distribution
 *
 * ZERO EMOJIS — all icons provided by lucide-react:
 *   Collected   — Sprout
 *   Tested      — FlaskConical
 *   Processed   — Settings2
 *   Packaged    — Package
 *   Distributed — Truck
 */

import { Sprout, FlaskConical, Settings2, Package, Truck, AlertTriangle, ShieldCheck } from "lucide-react";

const STAGES = [
  { key: "Collected",   label: "Collected",   Icon: Sprout },
  { key: "Tested",      label: "Tested",      Icon: FlaskConical },
  { key: "Processed",   label: "Processed",   Icon: Settings2 },
  { key: "Packaged",    label: "Packaged",    Icon: Package },
  { key: "Distributed", label: "Distributed", Icon: Truck },
];

function SupplyChainStats({ batches }) {
  const safeBatches = batches || [];
  const total = safeBatches.length;

  const getCount = (status) =>
    safeBatches.filter((batch) => batch.status === status).length;

  const delayed = safeBatches.filter((batch) => batch.delayed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "white", borderRadius: 14, border: "1px solid var(--border)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--forest)", color: "white", display: "grid", placeItems: "center" }}>
          <strong style={{ fontSize: 18 }}>{total}</strong>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ color: "var(--forest)", fontSize: 13 }}>
            Supply Chain Visibility
          </strong>
          <span style={{ color: "var(--muted)", fontSize: 11 }}>
            {delayed > 0
              ? `${delayed} batch${delayed === 1 ? "" : "es"} require attention`
              : "All tracked batches operating within normal threshold"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10, fontWeight: 700, color: delayed > 0 ? "var(--danger)" : "var(--success)" }}>
            {delayed > 0 ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
            {delayed > 0 ? "Attention Required" : "Operating Normally"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {STAGES.map(({ key, label, Icon }) => {
          const count = getCount(key);
          return (
            <div
              key={key}
              style={{
                padding: "8px 6px",
                borderRadius: 10,
                background: "white",
                border: "1px solid var(--border)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon size={16} color="var(--forest)" />
              <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
              <strong style={{ fontSize: 14, color: "var(--forest)" }}>{count}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SupplyChainStats;
