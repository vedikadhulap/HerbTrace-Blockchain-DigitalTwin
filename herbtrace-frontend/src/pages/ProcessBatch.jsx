import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Hash, Search, CheckCircle, XCircle, Leaf, MapPin, Scale,
  Settings2, FlaskConical, Percent, Thermometer, Award, Snowflake,
  Calendar, AlignLeft, FileText, Upload, Loader, GitBranch,
  ExternalLink, Plus, Timer,
} from "lucide-react";
import api from "../api";
import GPSBar from "../components/GPSBar";
import ErrorCard from "../components/ErrorCard";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

export default function ProcessBatch() {
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [coords, setCoords] = useState(null);
  const [parentInput, setParentInput] = useState("");
  const [confirmedBatches, setConfirmedBatches] = useState([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);

  const [reportFile, setReportFile]   = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);
  const [success, setSuccess]         = useState(null);
  const [toast, setToast]             = useState(null);

  const [form, setForm] = useState({
    outputProductName: "", processingMethod: "", solventUsed: "", outputQuantity: "",
    extractionRatio: "", activeCompoundConcentration: "", processingTemperature: "",
    processingDuration: "", qualityGrade: "", storageConditions: "", expiryDate: "", notes: "",
  });

  const field = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  const confirmBatches = async () => {
    if (!parentInput.trim()) return;
    const ids = parentInput.split(",").map(s => s.trim()).filter(Boolean);
    setLookingUp(true); setLookupResults(null);
    const BLOCKED = ['TEST_FAILED', 'QUARANTINED', 'RECALLED'];
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await api.get(`/batch/${id}`);
          const b = res.data;
          const isBlocked = BLOCKED.includes(b.status) || b.processingAllowed === false || (b.status !== 'TESTED' && b.status !== 'PROCESSED');
          return {
            id,
            batch: b,
            found: true,
            valid: !isBlocked,
            status: b.status,
            reason: b.labFailReason || b.quarantineReason || b.recallReason || (isBlocked ? `Batch is in ${b.status} state` : null)
          };
        } catch {
          return { id, batch: null, found: false, valid: false, status: 'NOT_FOUND', reason: 'Batch not found' };
        }
      })
    );
    setLookupResults(results);
    if (results.length > 0 && results.every(r => r.valid)) {
      setConfirmedBatches(results.map(r => r.batch));
    } else {
      setConfirmedBatches([]);
    }
    setLookingUp(false);
  };

  const allConfirmed = confirmedBatches.length > 0 &&
    lookupResults && lookupResults.length > 0 && lookupResults.every(r => r.valid);

  const requiredFilled = form.outputProductName && form.processingMethod && form.solventUsed &&
    form.outputQuantity && form.qualityGrade && form.storageConditions && form.expiryDate &&
    form.notes && reportFile;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allConfirmed || !requiredFilled) { setError("Please confirm all batches and fill required fields."); return; }
    setSubmitting(true); setError(null);

    const newBatchId = `PROCESSED-${Date.now()}`;
    const parentBatchIds = confirmedBatches.map(b => b.batchId);

    const processorNotes = JSON.stringify({
      outputProductName: form.outputProductName, processingMethod: form.processingMethod,
      solventUsed: form.solventUsed, outputQuantity: parseFloat(form.outputQuantity),
      extractionRatio: form.extractionRatio,
      activeCompoundConcentration: form.activeCompoundConcentration ? parseFloat(form.activeCompoundConcentration) : null,
      processingTemperature: form.processingTemperature ? parseFloat(form.processingTemperature) : null,
      processingDuration: form.processingDuration ? parseFloat(form.processingDuration) : null,
      qualityGrade: form.qualityGrade, storageConditions: form.storageConditions,
      expiryDate: form.expiryDate, notes: form.notes,
    });

    try {
      const res = await api.post("/batch/process", {
        newBatchId, parentBatchIds, processorNotes,
        latitude:  coords?.latitude  ?? 0,
        longitude: coords?.longitude ?? 0,
      });
      // Upload processing report
      const fd = new FormData();
      fd.append("batchId", newBatchId);
      fd.append("image", reportFile);
      await api.post("/batch/upload-image", fd);

      setSuccess({ newBatchId, parentBatchIds, agreedLocation: res.data.agreedLocation });
      setToast({ message: "Batch processed on-chain!", type: "success" });
    } catch (err) {
      setError(err.response?.data?.error || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 740, margin: "0 auto" }}>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 4 }}>Process Batch</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>Combine verified raw batches into a processed product on-chain.</p>
      </div>

      <GPSBar onCoordsChange={setCoords} />

      {success ? (
        <div className="glass-card fade-in" style={{ padding: "40px 36px", textAlign: "center" }}>
          <CheckCircle size={36} color="var(--fern)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", marginBottom: 12 }}>Batch Processed</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{success.newBatchId}</code>
            <StatusPill status="PROCESSED" />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: success.agreedLocation ? 8 : 20,
            fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <GitBranch size={14} />
            From: {success.parentBatchIds.join(", ")}
          </div>
          {success.agreedLocation && (
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MapPin size={14} color="var(--fern)" /> Recorded at: <strong>{success.agreedLocation}</strong>
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => navigate(`/verify/${success.newBatchId}`)}>
              <ExternalLink size={14} /> View Batch
            </button>
            <button className="btn-ghost" onClick={() => { setSuccess(null); setConfirmedBatches([]); setLookupResults(null); setParentInput(""); setForm({ outputProductName: "", processingMethod: "", solventUsed: "", outputQuantity: "", extractionRatio: "", activeCompoundConcentration: "", processingTemperature: "", processingDuration: "", qualityGrade: "", storageConditions: "", expiryDate: "", notes: "" }); setReportFile(null); }}>
              <Plus size={14} /> Process Another
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Step 1: Confirm Parent Batches ── */}
          <div className="glass-card" style={{ padding: "24px 28px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 14 }}>Step 1 — Confirm Parent Batches</h3>
            <div className="field-group" style={{ marginBottom: 12 }}>
              <label className="field-label"><Hash size={14} /> Parent Batch IDs (comma-separated)</label>
              <div className="field-input-wrapper">
                <Hash size={15} className="input-icon" />
                <input className="field-input" placeholder="e.g. ASHWAGANDHA-001, ASHWAGANDHA-002"
                  value={parentInput} onChange={e => setParentInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmBatches(); } }}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }} />
              </div>
            </div>
            <button className="btn-ghost" onClick={confirmBatches} disabled={lookingUp}>
              {lookingUp ? <Loader size={14} className="spin" /> : <Search size={14} />}
              {lookingUp ? "Confirming…" : "Confirm Batches"}
            </button>

            {lookupResults && (
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }} className="fade-in">
                {lookupResults.map(({ id, batch, found, valid, status, reason }) => (
                  <div key={id} style={{
                    padding: "12px 16px", borderRadius: 10, display: "flex", flexDirection: "column", gap: 6,
                    background: valid ? "var(--fern-dim)" : "rgba(255,80,80,0.12)",
                    border: `1px solid ${valid ? "var(--border-glow)" : "rgba(255,80,80,0.35)"}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {valid ? <CheckCircle size={15} color="var(--fern)" /> : <XCircle size={15} color="#ff4d4d" />}
                      <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", flex: 1, fontWeight: "bold" }}>{id}</code>
                      {found && (
                        <>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{batch.herbType}</span>
                          <StatusPill status={batch.status} />
                          {batch.quantityKg && <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{batch.quantityKg}kg</span>}
                        </>
                      )}
                      {!found && <span style={{ fontSize: "0.82rem", color: "#ff4d4d", fontWeight: "bold" }}>Not found</span>}
                    </div>
                    {!valid && found && (
                      <div style={{ fontSize: "0.80rem", color: "#ff4d4d", background: "rgba(255,0,0,0.08)", padding: "6px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
                        <strong>❌ PROCESSING BLOCKED:</strong> {reason || `Batch status is ${status}. Cannot be used for processing.`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Step 2: Processing Details ── */}
          {allConfirmed && (
            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: "28px 28px" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 20 }}>Step 2 — Processing Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                <div className="field-group">
                  <label className="field-label"><Leaf size={14} /> Output Product Name *</label>
                  <input className="field-input" type="text" required placeholder="e.g. Ashwagandha KSM-66 Extract" {...field("outputProductName")} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Settings2 size={14} /> Processing Method *</label>
                    <select className="field-select" required {...field("processingMethod")}>
                      <option value="">Select…</option>
                      <option>Drying</option><option>Solvent Extraction</option>
                      <option>Cold Press</option><option>Supercritical CO2 Extraction</option>
                      <option>Grinding</option><option>Distillation</option>
                      <option>Fermentation</option><option>Other</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label"><FlaskConical size={14} /> Solvent Used *</label>
                    <select className="field-select" required {...field("solventUsed")}>
                      <option value="">Select…</option>
                      <option>None (dry process)</option><option>Water</option>
                      <option>Ethanol</option><option>Methanol</option>
                      <option>Supercritical CO2</option><option>Hexane</option><option>Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Scale size={14} /> Output Qty (kg) *</label>
                    <input className="field-input" type="number" min="0.1" step="0.1" required placeholder="e.g. 80" {...field("outputQuantity")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Percent size={14} /> Extraction Ratio</label>
                    <input className="field-input" type="text" placeholder="e.g. 10:1" {...field("extractionRatio")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Percent size={14} /> Active Compound (%)</label>
                    <input className="field-input" type="number" min="0" max="100" step="0.01" placeholder="e.g. 5" {...field("activeCompoundConcentration")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Thermometer size={14} /> Processing Temp (°C)</label>
                    <input className="field-input" type="number" placeholder="e.g. 55" {...field("processingTemperature")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Timer size={14} /> Duration (hours)</label>
                    <input className="field-input" type="number" min="0" step="0.5" placeholder="e.g. 48" {...field("processingDuration")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Award size={14} /> Quality Grade *</label>
                    <select className="field-select" required {...field("qualityGrade")}>
                      <option value="">Select…</option>
                      <option>Grade A</option><option>Grade B</option>
                      <option>Grade C</option><option>Reject</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Snowflake size={14} /> Storage Conditions *</label>
                    <select className="field-select" required {...field("storageConditions")}>
                      <option value="">Select…</option>
                      <option>Room Temperature</option><option>Cool & Dry</option>
                      <option>Refrigerated (2–8°C)</option><option>Frozen (&lt;-18°C)</option>
                    </select>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label"><Calendar size={14} /> Batch Expiry Date *</label>
                  <input className="field-input" type="date" required {...field("expiryDate")} />
                </div>

                <div className="field-group">
                  <label className="field-label"><AlignLeft size={14} /> Processor Notes *</label>
                  <textarea className="field-textarea" required
                    placeholder="e.g. Combined and dried at 55°C for 48h. Output: 80kg standardized 5% withanolide extract."
                    {...field("notes")} />
                </div>

                {/* Processing Report upload */}
                <div className="field-group">
                  <label className="field-label"><FileText size={14} /> Processing Report *</label>
                  {reportFile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fern)", fontSize: "0.88rem" }}>
                      <CheckCircle size={16} /> {reportFile.name}
                      <button type="button" onClick={() => setReportFile(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>Change</button>
                    </div>
                  ) : (
                    <div className="upload-zone" onClick={() => fileRef.current?.click()} style={{ flexDirection: "column", display: "flex", alignItems: "center" }}>
                      <Upload size={22} color="var(--fern)" />
                      <span style={{ fontSize: "0.85rem" }}>Upload processing report (image or PDF) — required</span>
                      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                        onChange={e => setReportFile(e.target.files[0])} />
                    </div>
                  )}
                </div>

                <ErrorCard error={error} />

                <button type="submit" className="btn-primary" disabled={submitting || !requiredFilled}>
                  {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                  {submitting ? "Recording on-chain…" : "Submit Processing Record"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
