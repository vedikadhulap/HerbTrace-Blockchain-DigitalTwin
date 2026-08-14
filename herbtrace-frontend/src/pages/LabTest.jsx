import { useState, useEffect } from "react";
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

function LabTest() {
  const { coords, gpsStatus } = useGPS();

  // Step 1 — batch lookup
  const [lookupId, setLookupId]   = useState("");
  const [batch, setBatch]         = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError]     = useState(null);

  // Step 2 — test results
  const [testResults, setTestResults] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);
  const [result, setResult]           = useState(null);

  // File upload
  const [uploadFile, setUploadFile]   = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);

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
      const res = await api.post("/batch/lab-test", {
        batchId: batch.batchId,
        testResults,
        latitude:  coords?.latitude  ?? null,
        longitude: coords?.longitude ?? null,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Lab test submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCertUpload = async () => {
    if (!uploadFile || !result) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("batchId", result.batchId);
    fd.append("image", uploadFile);
    // TODO: protect this endpoint for any authenticated role
    try {
      const res = await api.post("/batch/upload-image", fd);
      setUploadedUrl(res.data.images?.slice(-1)[0] || "");
    } catch { /* silent */ }
    setUploading(false);
  };

  return (
    <div>
      {/* Step 1 — Batch lookup */}
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Record Lab Test</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>Find the batch, then submit your test results.</p>
        <GpsLine coords={coords} gpsStatus={gpsStatus} />

        <form onSubmit={handleLookup} style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <input id="labtest-batchid" type="text" className="field-input"
            value={lookupId} onChange={e => setLookupId(e.target.value)}
            placeholder="Batch ID — e.g. ASHWAGANDHA-1723456789"
            required style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "0.88rem" }} />
          <button type="submit" className="btn-primary" disabled={lookupLoading}
            style={{ flexShrink: 0, padding: "12px 22px", opacity: lookupLoading ? 0.6 : 1 }}>
            {lookupLoading ? "Looking up…" : "Look up"}
          </button>
        </form>
        {lookupError && <p style={{ color: "#E8A87C", marginTop: 12, fontSize: "0.88rem" }}>{lookupError}</p>}

        {/* Batch preview card */}
        {batch && !result && (
          <div style={{ marginTop: 20, padding: "18px 20px", borderRadius: 14, background: "rgba(61,107,79,0.12)", border: "1px solid rgba(61,107,79,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", margin: 0 }}>{batch.herbType}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--paper-dim)", margin: "4px 0 0" }}>{batch.batchId}</p>
              </div>
              <span className="status-pill">{batch.status}</span>
            </div>
            {batch.farmLocation && <p style={{ color: "var(--paper-dim)", fontSize: "0.82rem", marginTop: 8 }}>📍 {batch.farmLocation}</p>}
          </div>
        )}
      </div>

      {/* Step 2 — Test results form */}
      {batch && !result && (
        <div className="glass-panel" style={{ padding: "36px", marginTop: 16 }}>
          <div className="step-indicator" style={{ marginBottom: 20 }}>
            <div className="step-dot done">1</div>
            <div className="step-line" />
            <div className="step-dot active">2</div>
            <span className="step-label">Enter test results</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label className="field-label">Test results</label>
              <textarea id="labtest-results" className="field-input"
                value={testResults} onChange={e => setTestResults(e.target.value)}
                placeholder="e.g. Pesticide levels: ND. Heavy metals: ND. Moisture: 8.2%. pH: 6.1. Certificate: NABL/2026/0813."
                required rows={5} style={{ resize: "vertical" }} />
            </div>

            {error && <p style={{ color: "#E8A87C", fontSize: "0.88rem", margin: 0 }}>{error}</p>}

            <button id="labtest-submit" type="submit" className="btn-primary"
              disabled={submitting} style={{ opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Writing to chain…" : "Submit Lab Test"}
            </button>
          </form>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 16 }}>
          <span className="status-pill">TESTED</span>
          <h2 style={{ fontSize: "1.2rem", marginTop: 12 }}>{result.herbType}</h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--paper-dim)", marginTop: 6 }}>{result.batchId}</p>

          {result.txHash && (
            <div style={{ marginTop: 12, fontSize: "0.8rem" }}>
              <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" rel="noreferrer"
                style={{ color: "var(--fern-glow)", textDecoration: "underline" }}>
                View on Etherscan →
              </a>
            </div>
          )}

          {/* Certificate upload */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--glass-border)" }}>
            <label className="field-label">Upload lab certificate (optional)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*,application/pdf" onChange={e => setUploadFile(e.target.files[0])}
                className="field-input" style={{ flex: 1, padding: "9px 14px", cursor: "pointer" }} />
              {uploadFile && !uploadedUrl && (
                <button onClick={handleCertUpload} disabled={uploading} className="btn-primary"
                  style={{ fontSize: "0.85rem", padding: "10px 18px", opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              )}
            </div>
            {uploadedUrl && (
              <a href={uploadedUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--fern-glow)", fontSize: "0.82rem", display: "block", marginTop: 8, textDecoration: "underline" }}>
                View certificate on IPFS ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LabTest;
