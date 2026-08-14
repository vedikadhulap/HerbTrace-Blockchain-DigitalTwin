import { useState } from "react";
import api from "../api";

function Verify() {
  const [batchId, setBatchId] = useState("");
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [parents, setParents] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!batchId.trim()) return;

    setLoading(true);
    setError(null);
    setBatch(null);
    setParents([]);

    try {
      const res = await api.get(`/batch/verify/${batchId.trim()}`);
      setBatch(res.data.batch);
      setParents(res.data.parents || []);
      //console.log(res.data);
    } catch (err) {
      setError("Batch not found. Check the ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Verify a Batch</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Enter a batch ID to see its full history on-chain.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <input
            type="text"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="e.g. BATCH-0001"
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid var(--glass-border)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--paper)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.95rem",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: "var(--moss)",
              color: "var(--paper)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {loading ? "Checking..." : "Verify"}
          </button>
        </form>

        {error && (
          <p style={{ color: "#E8A87C", marginTop: 16 }}>{error}</p>
        )}
      </div>

      {batch && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1.3rem" }}>{batch.herbType}</h2>
            <span className="status-pill">{batch.status}</span>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--paper-dim)", marginTop: 6 }}>
            {batch.batchId}
          </p>
          <div style={{ marginTop: 20, color: "var(--paper-dim)", fontSize: "0.9rem", lineHeight: 1.8 }}>
            <div>Farm location: {batch.farmLocation}</div>
            <div>Quantity: {batch.quantityKg} kg</div>
            <div>Harvest date: {new Date(batch.harvestDate).toLocaleDateString()}</div>
          </div>
        </div>
      )}

      {parents.length > 0 && (
  <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--glass-border)" }}>
    <h3 style={{ fontSize: "1rem", color: "var(--paper-dim)", marginBottom: 12 }}>
      Parent Batches
    </h3>
    {parents.map((p) => (
      <div
        key={p.batchId}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.85rem",
          color: "var(--paper-dim)",
          padding: "8px 0",
        }}
      >
        {p.batchId} — {p.herbType}
      </div>
    ))}
  </div>
  )}  
    </div>
  );
}

export default Verify;