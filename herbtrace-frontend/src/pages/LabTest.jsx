import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Hash, Search, Leaf, Sprout, MapPin, Calendar, User, CheckCircle,
  FlaskConical, Atom, Droplets, Gauge, TestTube, Microscope, Package,
  Layers, Award, Building2, AlignLeft, Upload, Loader, ExternalLink, Beaker,
} from "lucide-react";
import api from "../api";
import GPSBar from "../components/GPSBar";
import ErrorCard from "../components/ErrorCard";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

export default function LabTest() {
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [coords, setCoords]   = useState(null);
  const [batchInput, setBatchInput] = useState("");
  const [batch, setBatch]     = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const [certFile, setCertFile]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [toast, setToast]         = useState(null);

  const [form, setForm] = useState({
    testDate: "", pesticideLevel: "", heavyMetals: "", moistureContent: "",
    phLevel: "", activeCompound: "", testMethod: "", sampleSize: "",
    microbialContamination: "", ashContent: "", foreignMatter: "",
    certificateNumber: "", certifyingBody: "", additionalNotes: "",
  });

  const field = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  const overallResult = form.pesticideLevel && form.heavyMetals && form.microbialContamination
    ? (form.pesticideLevel === "Exceeds Safe Limits" || form.heavyMetals === "Exceeds Safe Limits" || form.microbialContamination === "Exceeds Limits" ? "FAIL" : "PASS")
    : null;

  const requiredFilled = form.testDate && form.pesticideLevel && form.heavyMetals &&
    form.moistureContent && form.phLevel && form.activeCompound && form.testMethod &&
    form.sampleSize && form.microbialContamination && form.certificateNumber &&
    form.certifyingBody && certFile;

  /* ── Batch lookup ── */
  const lookupBatch = async () => {
    if (!batchInput.trim()) return;
    setLookingUp(true); setLookupError(null); setBatch(null);
    try {
      const res = await api.get(`/batch/${batchInput.trim()}`);
      setBatch(res.data);
    } catch (err) {
      setLookupError(err.response?.status === 404 ? "Batch not found." : "Lookup failed.");
    } finally {
      setLookingUp(false);
    }
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!requiredFilled) { setError("Please fill all required fields and upload the certificate."); return; }
    setSubmitting(true); setError(null);

    const testResults = JSON.stringify({
      testDate: form.testDate, pesticideLevel: form.pesticideLevel, heavyMetals: form.heavyMetals,
      moistureContent: parseFloat(form.moistureContent), phLevel: parseFloat(form.phLevel),
      activeCompound: parseFloat(form.activeCompound), testMethod: form.testMethod,
      sampleSize: parseFloat(form.sampleSize), microbialContamination: form.microbialContamination,
      ashContent: form.ashContent ? parseFloat(form.ashContent) : null,
      foreignMatter: form.foreignMatter ? parseFloat(form.foreignMatter) : null,
      certificateNumber: form.certificateNumber, certifyingBody: form.certifyingBody,
      additionalNotes: form.additionalNotes, overallResult,
    });

    try {
      const res = await api.post("/batch/lab-test", {
        batchId: batch.batchId,
        testResults,
        labOutcome: overallResult,
        passed: overallResult === 'PASS',
        labFailReason: overallResult === 'FAIL' ? (form.additionalNotes || 'Lab test failed quality standards') : '',
        latitude:  coords?.latitude  ?? 0,
        longitude: coords?.longitude ?? 0,
      });
      // Upload certificate
      const fd = new FormData();
      fd.append("batchId", batch.batchId);
      fd.append("image", certFile);
      await api.post("/batch/upload-image", fd);

      setSuccess({ batchId: batch.batchId, overallResult, agreedLocation: res.data.agreedLocation });
      setToast({ message: "Lab test recorded on-chain!", type: "success" });
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
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 4 }}>Record Lab Test</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>Look up a batch and submit structured test results with a certificate.</p>
      </div>

      <GPSBar onCoordsChange={setCoords} />

      {success ? (
        <div className="glass-card fade-in" style={{ padding: "40px 36px", textAlign: "center" }}>
          <CheckCircle size={36} color="var(--fern)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", marginBottom: 12 }}>Lab Test Recorded</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
            <StatusPill status="TESTED" />
            <StatusPill status={success.overallResult} />
          </div>
          {success.agreedLocation && (
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MapPin size={14} color="var(--fern)" /> Recorded at: <strong>{success.agreedLocation}</strong>
            </p>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={() => navigate(`/verify/${success.batchId}`)}>
              <ExternalLink size={14} /> View Full Batch History
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Step 1: Batch Lookup ── */}
          <div className="glass-card" style={{ padding: "24px 28px", marginBottom: 16 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 14 }}>Step 1 — Look Up Batch</h3>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div className="field-input-wrapper" style={{ flex: 1 }}>
                <Hash size={15} className="input-icon" />
                <input className="field-input" placeholder="Batch ID — e.g. ASHWAGANDHA-1786…"
                  value={batchInput} onChange={e => setBatchInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && lookupBatch()}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }} />
              </div>
              <button className="btn-ghost" onClick={lookupBatch} disabled={lookingUp}>
                {lookingUp ? <Loader size={14} className="spin" /> : <Search size={14} />}
                {lookingUp ? "Looking up…" : "Look Up Batch"}
              </button>
            </div>

            {lookupError && <div className="error-generic"><Search size={14} style={{ flexShrink: 0 }} /><span>{lookupError}</span></div>}

            {batch && (
              <div style={{
                padding: "14px 18px", borderRadius: 12, background: "var(--fern-dim)",
                border: "1px solid var(--border-glow)", display: "flex", flexWrap: "wrap", gap: 14,
              }} className="fade-in">
                <CheckCircle size={16} color="var(--fern)" style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{batch.herbType}</span>
                    <StatusPill status={batch.status} />
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {batch.farmLocation && <span style={{ display: "flex", gap: 4 }}><MapPin size={12} />{batch.farmLocation}</span>}
                    {batch.farmerWallet && <span style={{ display: "flex", gap: 4 }}><User size={12} />{batch.farmerWallet.slice(0, 10)}…</span>}
                    {batch.harvestDate  && <span style={{ display: "flex", gap: 4 }}><Calendar size={12} />{new Date(batch.harvestDate).toLocaleDateString("en-IN")}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 2: Test Results Form ── */}
          {batch && (
            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: "28px 28px" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 20 }}>Step 2 — Test Results</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                <div className="field-group">
                  <label className="field-label"><Calendar size={14} /> Test Date *</label>
                  <input className="field-input" type="date" required {...field("testDate")} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><FlaskConical size={14} /> Pesticide Level *</label>
                    <select className="field-select" required {...field("pesticideLevel")}>
                      <option value="">Select…</option>
                      <option>Not Detected (ND)</option>
                      <option>Within Safe Limits</option>
                      <option>Exceeds Safe Limits</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Atom size={14} /> Heavy Metals *</label>
                    <select className="field-select" required {...field("heavyMetals")}>
                      <option value="">Select…</option>
                      <option>Not Detected (ND)</option>
                      <option>Within Safe Limits</option>
                      <option>Exceeds Safe Limits</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Droplets size={14} /> Moisture (%) *</label>
                    <input className="field-input" type="number" min="0" max="100" step="0.01" required placeholder="e.g. 8.5" {...field("moistureContent")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Gauge size={14} /> pH Level *</label>
                    <input className="field-input" type="number" min="0" max="14" step="0.01" required placeholder="e.g. 6.5" {...field("phLevel")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><FlaskConical size={14} /> Active Compound (%) *</label>
                    <input className="field-input" type="number" min="0" max="100" step="0.01" required placeholder="e.g. 5.2" {...field("activeCompound")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><TestTube size={14} /> Test Method *</label>
                    <select className="field-select" required {...field("testMethod")}>
                      <option value="">Select…</option>
                      <option>HPLC</option><option>GC-MS</option>
                      <option>Spectrophotometry</option><option>Titration</option>
                      <option>UV-Vis</option><option>ICP-MS</option><option>Other</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Beaker size={14} /> Sample Size (g) *</label>
                    <input className="field-input" type="number" min="0.1" step="0.1" required placeholder="e.g. 10" {...field("sampleSize")} />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label"><Microscope size={14} /> Microbial Contamination *</label>
                  <select className="field-select" required {...field("microbialContamination")}>
                    <option value="">Select…</option>
                    <option>Within Limits</option><option>Exceeds Limits</option><option>Not Tested</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Package size={14} /> Ash Content (%)</label>
                    <input className="field-input" type="number" min="0" max="100" step="0.01" placeholder="optional" {...field("ashContent")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Layers size={14} /> Foreign Matter (%)</label>
                    <input className="field-input" type="number" min="0" max="100" step="0.01" placeholder="optional" {...field("foreignMatter")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Award size={14} /> Certificate Number *</label>
                    <input className="field-input" type="text" required placeholder="e.g. NABL/2026/0813" {...field("certificateNumber")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Building2 size={14} /> Certifying Body *</label>
                    <input className="field-input" type="text" required placeholder="e.g. NABL, ISO 17025" {...field("certifyingBody")} />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label"><AlignLeft size={14} /> Additional Notes</label>
                  <textarea className="field-textarea" placeholder="Any additional observations…" {...field("additionalNotes")} />
                </div>

                {/* Certificate upload — REQUIRED */}
                <div className="field-group">
                  <label className="field-label"><Upload size={14} /> Lab Certificate *</label>
                  {certFile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fern)", fontSize: "0.88rem" }}>
                      <CheckCircle size={16} /> {certFile.name}
                      <button type="button" onClick={() => setCertFile(null)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="upload-zone" onClick={() => fileRef.current?.click()}
                      style={{ flexDirection: "column", display: "flex", alignItems: "center" }}>
                      <Upload size={22} color="var(--fern)" />
                      <span style={{ fontSize: "0.85rem" }}>Upload certificate (image or PDF) — required</span>
                      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                        onChange={e => setCertFile(e.target.files[0])} />
                    </div>
                  )}
                </div>

                {/* Live PASS/FAIL preview */}
                {overallResult && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
                    borderRadius: 10, background: "var(--fern-dim)", border: "1px solid var(--border-glow)" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>This batch will be marked as:</span>
                    <StatusPill status={overallResult} />
                  </div>
                )}

                <ErrorCard error={error} />

                <button type="submit" className="btn-primary" disabled={submitting || !requiredFilled}>
                  {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                  {submitting ? "Recording on-chain…" : "Submit Lab Test"}
                </button>
                {!requiredFilled && !submitting && (
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>
                    All required fields and certificate must be filled to submit.
                  </p>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
