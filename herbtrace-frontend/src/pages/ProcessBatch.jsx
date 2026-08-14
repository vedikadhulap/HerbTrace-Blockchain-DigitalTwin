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

function ProcessBatch() {
  const { coords, gpsStatus } = useGPS();

  // Step 1 — parent batch IDs input + confirmation
  const [rawIds, setRawIds]         = useState("");
  const [parents, setParents]       = useState([]); // confirmed batch objects
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // Step 2 — processor notes
  const [processorNotes, setProcessorNotes] = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState(null);
  const [result, setResult]                 = useState(null);

  // File upload
  const [uploadFile, setUploadFile]   = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);

  const handleConfirm = async (e) => {
    e.preventDefault();
    const ids = rawIds.split(",").map(s => s.trim()).filter(Boolean);
    if (!ids.length) { setConfirmError("Enter at least one batch ID."); return; }

    setConfirming(true);
    setConfirmError(null);
    setParents([]);

    const found = [];
    const notFound = [];
    for (const id of ids) {
      try {
        const res = await api.get(`/batch/${id}`);
        found.push(res.data);
      } catch {
        notFound.push(id);
      }
    }

    if (notFound.length) {
      setConfirmError(`Not found: ${notFound.join(", ")}`);
    } else {
      setParents(found);
    }
    setConfirming(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const newBatchId = `PROCESSED-${Date.now()}`;
    try {
      const res = await api.post("/batch/process", {
        newBatchId,
        parentBatchIds: parents.map(p => p.batchId),
        processorNotes,
        latitude:  coords?.latitude  ?? null,
        longitude: coords?.longitude ?? null,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Processing failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportUpload = async () => {
    if (!uploadFile || !result) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("batchId", result.batchId);
    fd.append("image", uploadFile);
    try {
      const res = await api.post("/batch/upload-image", fd);
      setUploadedUrl(res.data.images?.slice(-1)[0] || "");
    } catch { /* silent */ }
    setUploading(false);
  };

  return (
    <div>
      {/* Step 1 — parent batch lookup */}
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Process Batch</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Combine one or more tested batches into a new processed batch.
        </p>
        <GpsLine coords={coords} gpsStatus={gpsStatus} />

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
          <div>
            <label className="field-label">Parent batch IDs (comma-separated)</label>
            <input id="process-parents" type="text" className="field-input"
              value={rawIds} onChange={e => setRawIds(e.target.value)}
              placeholder="ASHWAGANDHA-123, ASHWAGANDHA-456"
              required style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }} />
            <p style={{ fontSize: "0.78rem", color: "var(--paper-dim)", marginTop: 6 }}>
              Separate multiple IDs with commas.
            </p>
          </div>
          <button type="submit" className="btn-primary" disabled={confirming}
            style={{ alignSelf: "flex-start", opacity: confirming ? 0.6 : 1 }}>
            {confirming ? "Confirming…" : "Confirm batches"}
          </button>
        </form>

        {confirmError && <p style={{ color: "#E8A87C", marginTop: 12, fontSize: "0.88rem" }}>{confirmError}</p>}

        {/* Confirmed parent cards */}
        {parents.length > 0 && !result && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {parents.map(p => (
              <div key={p.batchId} style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(61,107,79,0.12)", border: "1px solid rgba(61,107,79,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.88rem", margin: 0 }}>{p.herbType}</p>
                  <span className="status-pill">{p.status}</span>
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.77rem", color: "var(--paper-dim)", margin: "4px 0 0" }}>{p.batchId}</p>
                {p.quantityKg && <p style={{ fontSize: "0.8rem", color: "var(--paper-dim)", margin: "3px 0 0" }}>{p.quantityKg} kg</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — processor notes */}
      {parents.length > 0 && !result && (
        <div className="glass-panel" style={{ padding: "36px", marginTop: 16 }}>
          <div className="step-indicator" style={{ marginBottom: 20 }}>
            <div className="step-dot done">1</div>
            <div className="step-line" />
            <div className="step-dot active">2</div>
            <span className="step-label">Processing details</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label className="field-label">Processor notes</label>
              <textarea id="process-notes" className="field-input"
                value={processorNotes} onChange={e => setProcessorNotes(e.target.value)}
                placeholder="e.g. Combined and dried. Output: 80kg standardized 5% withanolide extract."
                rows={4} style={{ resize: "vertical" }} />
            </div>

            {error && <p style={{ color: "#E8A87C", fontSize: "0.88rem", margin: 0 }}>{error}</p>}

            <button id="process-submit" type="submit" className="btn-primary"
              disabled={submitting} style={{ opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Writing to chain…" : "Process Batch"}
            </button>
          </form>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 16 }}>
          <span className="status-pill">PROCESSED</span>
          <h2 style={{ fontSize: "1.2rem", marginTop: 12 }}>New batch created</h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--paper-dim)", marginTop: 6 }}>{result.batchId}</p>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginTop: 8 }}>
            Combined from: {result.parentBatchIds?.join(", ")}
          </p>
          {result.txHash && (
            <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank" rel="noreferrer"
              style={{ color: "var(--fern-glow)", fontSize: "0.82rem", display: "block", marginTop: 10, textDecoration: "underline" }}>
              View on Etherscan →
            </a>
          )}

          {/* Report upload */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--glass-border)" }}>
            <label className="field-label">Upload processing report (optional)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*,application/pdf" onChange={e => setUploadFile(e.target.files[0])}
                className="field-input" style={{ flex: 1, padding: "9px 14px", cursor: "pointer" }} />
              {uploadFile && !uploadedUrl && (
                <button onClick={handleReportUpload} disabled={uploading} className="btn-primary"
                  style={{ fontSize: "0.85rem", padding: "10px 18px", opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              )}
            </div>
            {uploadedUrl && (
              <a href={uploadedUrl} target="_blank" rel="noreferrer"
                style={{ color: "var(--fern-glow)", fontSize: "0.82rem", display: "block", marginTop: 8, textDecoration: "underline" }}>
                View report on IPFS ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProcessBatch;
