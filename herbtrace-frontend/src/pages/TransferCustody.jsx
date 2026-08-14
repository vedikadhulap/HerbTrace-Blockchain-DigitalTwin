import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function useGPS() {
  const [coords, setCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("getting");
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setGpsStatus("captured"); },
      ()  => setGpsStatus("unavailable")
    );
  }, []);
  return { coords, gpsStatus };
}

function GpsLine({ coords, gpsStatus }) {
  const info = {
    getting:     { color: "var(--paper-dim)", text: "Getting your location…" },
    captured:    { color: "var(--fern-glow)", text: `Location captured (${coords?.latitude?.toFixed(4)}, ${coords?.longitude?.toFixed(4)})` },
    unavailable: { color: "#E8A87C",          text: "Location unavailable — proceeding without GPS" },
  }[gpsStatus];
  return <div className="gps-line" style={{ color: info.color }}>📍 {info.text}</div>;
}

function TransferCustody() {
  const { coords, gpsStatus } = useGPS();

  // Step 1 — batch lookup
  const [lookupId, setLookupId]         = useState("");
  const [batch, setBatch]               = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]   = useState(null);

  // Step 2 — transfer details
  const [newOwner, setNewOwner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);

  const handleLookup = async (e) => {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);
    setBatch(null);
    try {
      const res = await api.get(`/batch/${lookupId.trim()}`);
      setBatch(res.data);
    } catch {
      setLookupError("Batch not found. Check the ID and try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/batch/transfer", {
        batchId: batch.batchId,
        newOwner: newOwner.trim(),
        senderRole: "distributor", // hardcoded — distributor JWT already proves the role
        latitude:  coords?.latitude  ?? null,
        longitude: coords?.longitude ?? null,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Step 1 — Batch lookup */}
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Transfer Custody</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Record the handoff of a processed batch to a retailer.
        </p>
        <p style={{ fontSize: "0.82rem", color: "var(--sage)", marginTop: 6 }}>
          Once transferred, the batch's full journey is complete and verifiable by the retailer's customers.
        </p>
        <GpsLine coords={coords} gpsStatus={gpsStatus} />

        <form onSubmit={handleLookup} style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <input id="transfer-batchid" type="text" className="field-input"
            value={lookupId} onChange={e => setLookupId(e.target.value)}
            placeholder="Batch ID — e.g. PROCESSED-1723456789"
            required style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "0.88rem" }} />
          <button type="submit" className="btn-primary" disabled={lookupLoading}
            style={{ flexShrink: 0, padding: "12px 22px", opacity: lookupLoading ? 0.6 : 1 }}>
            {lookupLoading ? "Looking up…" : "Look up"}
          </button>
        </form>
        {lookupError && <p style={{ color: "#E8A87C", marginTop: 12, fontSize: "0.88rem" }}>{lookupError}</p>}

        {/* Batch preview */}
        {batch && !result && (
          <div style={{ marginTop: 20, padding: "18px 20px", borderRadius: 14, background: "rgba(61,107,79,0.12)", border: "1px solid rgba(61,107,79,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", margin: 0 }}>{batch.herbType}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--paper-dim)", margin: "4px 0 0" }}>{batch.batchId}</p>
              </div>
              <span className="status-pill">{batch.status}</span>
            </div>
            {batch.processorNotes && <p style={{ color: "var(--paper-dim)", fontSize: "0.82rem", marginTop: 8, fontStyle: "italic" }}>{batch.processorNotes}</p>}
          </div>
        )}
      </div>

      {/* Step 2 — Transfer details */}
      {batch && !result && (
        <div className="glass-panel" style={{ padding: "36px", marginTop: 16 }}>
          <div className="step-indicator" style={{ marginBottom: 20 }}>
            <div className="step-dot done">1</div>
            <div className="step-line" />
            <div className="step-dot active">2</div>
            <span className="step-label">Enter retailer details</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label className="field-label">Retailer wallet address</label>
              <input id="transfer-newowner" type="text" className="field-input"
                value={newOwner} onChange={e => setNewOwner(e.target.value)}
                placeholder="0x..." required style={{ fontFamily: "var(--font-mono)" }} />
            </div>

            {error && <p style={{ color: "#E8A87C", fontSize: "0.88rem", margin: 0 }}>{error}</p>}

            <button id="transfer-submit" type="submit" className="btn-primary"
              disabled={submitting} style={{ opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Writing to chain…" : "Transfer Custody"}
            </button>
          </form>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 16 }}>
          <span className="status-pill">TRANSFERRED</span>
          <h2 style={{ fontSize: "1.2rem", marginTop: 12 }}>Custody transferred</h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--paper-dim)", marginTop: 6 }}>{result.batchId}</p>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginTop: 8 }}>
            New owner:{" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
              {newOwner.slice(0, 12)}…{newOwner.slice(-6)}
            </span>
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--fern-glow)", marginTop: 10 }}>
            This batch is now fully traceable.
          </p>
          <Link to={`/verify/${result.batchId}`} style={{ color: "var(--fern-glow)", fontSize: "0.88rem", display: "inline-block", marginTop: 6, textDecoration: "underline" }}>
            View full batch history →
          </Link>
          {result.txHash && (
            <div style={{ marginTop: 10 }}>
              <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" rel="noreferrer"
                style={{ color: "var(--fern-glow)", fontSize: "0.82rem", textDecoration: "underline" }}>
                View on Etherscan →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TransferCustody;
