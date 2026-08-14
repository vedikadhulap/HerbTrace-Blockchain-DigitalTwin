import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

function Verify() {
  const { batchId: urlBatchId } = useParams();

  const [inputId, setInputId] = useState(urlBatchId || "");
  const [batch,   setBatch]   = useState(null);
  const [parents, setParents] = useState([]);
  const [qrCode,  setQrCode]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const doVerify = useCallback(async (id) => {
    if (!id?.trim()) return;
    setLoading(true);
    setError(null);
    setBatch(null);
    setParents([]);
    setQrCode(null);

    try {
      const res = await api.get(`/batch/verify/${id.trim()}`);
      setBatch(res.data.batch);
      setParents(res.data.parents || []);

      // Fetch QR code (best-effort — don't fail the whole page if it errors)
      try {
        const qrRes = await api.get(`/batch/qrcode/${id.trim()}`);
        setQrCode(qrRes.data.qrCode); // base64 data URI
      } catch { /* QR is nice-to-have */ }
    } catch {
      setError("Batch not found. Check the ID and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run if batchId is in the URL (QR scan flow)
  useEffect(() => {
    if (urlBatchId) doVerify(urlBatchId);
  }, [urlBatchId, doVerify]);

  const handleSubmit = (e) => {
    e.preventDefault();
    doVerify(inputId);
  };

  // QR download helper
  const downloadQR = () => {
    if (!qrCode) return;
    const a = document.createElement("a");
    a.href = qrCode;
    a.download = `herbtrace-qr-${batch?.batchId || "batch"}.png`;
    a.click();
  };

  return (
    <div>
      {/* Search panel */}
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Verify a Batch</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Enter a batch ID to see its full history on-chain. No account required.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <input
            id="verify-input"
            type="text"
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            placeholder="e.g. ASHWAGANDHA-1723456789"
            className="field-input"
            style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}
          />
          <button id="verify-btn" type="submit" className="btn-primary" disabled={loading}
            style={{ flexShrink: 0, padding: "12px 24px" }}>
            {loading ? "Checking…" : "Verify"}
          </button>
        </form>

        {error && <p style={{ color: "#E8A87C", marginTop: 16, fontSize: "0.9rem" }}>{error}</p>}
      </div>

      {/* Result card */}
      {batch && (
        <div className="glass-panel" style={{ padding: "36px", marginTop: 20 }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: "1.5rem" }}>{batch.herbType}</h2>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--paper-dim)", marginTop: 6 }}>
                {batch.batchId}
              </p>
            </div>
            <span className="status-pill">{batch.status}</span>
          </div>

          {/* Details grid */}
          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", fontSize: "0.88rem", color: "var(--paper-dim)" }}>
            {batch.farmLocation && (
              <div><span style={{ color: "var(--paper)" }}>Farm</span><br />{batch.farmLocation}</div>
            )}
            {batch.quantityKg && (
              <div><span style={{ color: "var(--paper)" }}>Quantity</span><br />{batch.quantityKg} kg</div>
            )}
            {batch.harvestDate && (
              <div><span style={{ color: "var(--paper)" }}>Harvest</span><br />{new Date(batch.harvestDate).toLocaleDateString()}</div>
            )}
            {batch.location?.latitude != null && (
              <div>
                <span style={{ color: "var(--paper)" }}>GPS</span><br />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                  📍 {batch.location.latitude.toFixed(5)}, {batch.location.longitude.toFixed(5)}
                </span>
              </div>
            )}
          </div>

          {/* Data hash */}
          {batch.dataHash && (
            <div style={{ marginTop: 20, padding: "10px 14px", borderRadius: 10, background: "rgba(0,0,0,0.2)" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--paper-dim)", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
                DATA HASH
              </span>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--paper-dim)", margin: "4px 0 0", wordBreak: "break-all" }}>
                {batch.dataHash}
              </p>
            </div>
          )}

          {/* Etherscan link */}
          {batch.txHash && (
            <div style={{ marginTop: 14, fontSize: "0.8rem" }}>
              <span style={{ color: "var(--paper-dim)", fontFamily: "var(--font-mono)" }}>
                tx: {batch.txHash.slice(0, 22)}…
              </span>
              <a
                href={`https://sepolia.etherscan.io/tx/${batch.txHash}`}
                target="_blank" rel="noreferrer"
                style={{ color: "var(--fern-glow)", marginLeft: 10, textDecoration: "underline" }}
              >
                View on Etherscan →
              </a>
            </div>
          )}

          {/* QR code */}
          {qrCode && (
            <div style={{ marginTop: 28 }}>
              <p style={{ fontSize: "0.82rem", color: "var(--paper-dim)", marginBottom: 12 }}>
                Scan to verify this batch:
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <img
                  src={qrCode}
                  alt={`QR code for ${batch.batchId}`}
                  style={{ width: 140, height: 140, borderRadius: 10, background: "white", padding: 8, display: "block" }}
                />
                <button onClick={downloadQR} className="btn-outline" style={{ fontSize: "0.82rem", padding: "8px 16px" }}>
                  Download QR
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parent batches */}
      {parents.length > 0 && (
        <div className="glass-panel" style={{ padding: "28px 36px", marginTop: 16 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--paper-dim)", marginBottom: 16 }}>
            Ingredient Batches
          </h3>
          {parents.map(p => (
            <div key={p.batchId} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 0", borderBottom: "1px solid var(--glass-border)",
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.83rem", margin: 0 }}>{p.batchId}</p>
                <p style={{ color: "var(--paper-dim)", fontSize: "0.82rem", margin: "4px 0 0" }}>
                  {p.herbType} {p.farmLocation && `· ${p.farmLocation}`}
                </p>
              </div>
              <span className="status-pill">{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Verify;