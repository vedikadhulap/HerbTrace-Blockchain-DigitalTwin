import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Hash, Search, Leaf, Sprout, MapPin, Scale, Calendar,
  Fingerprint, ExternalLink, Copy, Download, Share2, FlaskConical,
  Atom, Droplets, Gauge, Microscope, Award, TestTube, FileText,
  GitBranch, CheckCircle, ScanLine, QrCode, Clock, Truck,
  Settings2, ShieldCheck, Thermometer, ChevronRight, Store,
  AlertTriangle,
} from "lucide-react";
import api from "../api";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

function CopyBtn({ text, size = 13 }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copy" style={{
      background: "none", border: "none", cursor: "pointer",
      color: copied ? "var(--fern)" : "var(--text-muted)",
      padding: "2px 4px", display: "inline-flex", alignItems: "center",
      transition: "color 0.2s ease",
    }}>
      {copied ? <CheckCircle size={size} /> : <Copy size={size} />}
    </button>
  );
}

function formatDate(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ icon: Icon, label, value, mono = false, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <Icon size={14} color="var(--text-muted)" style={{ marginTop: 3, flexShrink: 0 }} />
      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? "var(--font-mono)" : undefined, fontSize: "0.88rem", wordBreak: "break-all", flex: 1 }}>
        {value}{children}
      </span>
    </div>
  );
}

const STATUS_ORDER = { CREATED: 0, TESTED: 1, PROCESSED: 2, TRANSFERRED: 3 };

export default function Verify() {
  const { batchId: paramId } = useParams();
  const navigate             = useNavigate();
  const [inputId, setInputId]   = useState(paramId || "");
  const [batch, setBatch]       = useState(null);
  const [parents, setParents]   = useState([]);
  const [qrCode, setQrCode]     = useState(null);
  const [locationVerifs, setLocationVerifs] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [toast, setToast]       = useState(null);

  // Build a quick lookup: { TEST: "Mumbai, MH", PROCESS: "Pune, MH", ... }
  const locationByStage = locationVerifs.reduce((acc, rec) => {
    if (rec.agreedLocation) acc[rec.stage] = rec.agreedLocation;
    return acc;
  }, {});

  const fetchBatch = async (id) => {
    if (!id) return;
    setLoading(true); setError(null); setBatch(null); setQrCode(null); setLocationVerifs([]);
    try {
      const [verifyRes, qrRes, locRes] = await Promise.all([
        api.get(`/batch/verify/${id}`),
        api.get(`/batch/qrcode/${id}`).catch(() => ({ data: { qrCode: null } })),
        // Location verifications — silently swallow 404 (no records yet is fine)
        api.get(`/batch/${id}/location-verification`).catch(() => ({ data: [] })),
      ]);
      setBatch(verifyRes.data.batch);
      setParents(verifyRes.data.parents || []);
      setQrCode(qrRes.data.qrCode);
      setLocationVerifs(Array.isArray(locRes.data) ? locRes.data : []);
    } catch (err) {
      setError(err.response?.status === 404 ? "No batch found with that ID." : "Lookup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramId) { setInputId(paramId); fetchBatch(paramId); }
  }, [paramId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputId.trim()) navigate(`/verify/${inputId.trim()}`);
  };

  const getQRDataUrl = () => {
    if (!qrCode) return "";
    return qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`;
  };

  const downloadQR = () => {
    const dataUrl = getQRDataUrl();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${batch.batchId}-qr.png`;
    a.click();
  };

  const shareLink = () => {
    const url = `${window.location.origin}/verify/${batch.batchId}`;
    navigator.clipboard.writeText(url).then(() => setToast({ message: "Verification link copied!", type: "success" }));
  };

  const lab = batch?.labData;
  const overallResult = lab
    ? (lab.pesticideLevel === "Exceeds Safe Limits" || lab.heavyMetals === "Exceeds Safe Limits" || lab.microbialContamination === "Exceeds Limits" ? "FAIL" : "PASS")
    : null;

  const currentStepNum = batch ? (STATUS_ORDER[batch.status] ?? 0) : 0;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", paddingBottom: 60 }}>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* ── Search Bar ── */}
      <div className="glass-card" style={{ padding: "28px 28px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <ShieldCheck size={24} color="var(--fern)" />
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.65rem" }}>Blockchain Batch Verification</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 20 }}>
          Inspect the immutable on-chain audit trail from origin farm to consumer packaging.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10 }}>
          <div className="field-input-wrapper" style={{ flex: 1 }}>
            <Hash size={15} className="input-icon" />
            <input className="field-input" placeholder="e.g. PROCESSED-1786908690014, BATCH001"
              value={inputId} onChange={e => setInputId(e.target.value)}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !inputId.trim()}>
            {loading ? <Search size={16} className="spin" /> : <Search size={16} />}
            {loading ? "Searching…" : "Verify"}
          </button>
        </form>
      </div>

      {error && (
        <div className="error-generic" style={{ marginBottom: 24 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}

      {batch && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="fade-in-up">

          {/* ── Top Batch Header & QR Card ── */}
          <div className="glass-card" style={{ padding: "32px", position: "relative", overflow: "hidden" }}>


            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Verified Supply Chain Asset
                  </span>
                  <StatusPill status={batch.status} />
                </div>

                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", marginBottom: 12 }}>
                  {batch.processorData?.outputProductName || batch.herbType}
                </h2>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <code style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.85rem",
                    padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--border)", color: "var(--fern)",
                  }}>
                    {batch.batchId}
                  </code>
                  <CopyBtn text={batch.batchId} size={14} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                  {batch.herbVariety && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Leaf size={14} color="var(--fern)" /> Variety: <strong>{batch.herbVariety}</strong>
                    </span>
                  )}
                  {batch.farmingMethod && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Sprout size={14} color="var(--fern)" /> Method: <strong>{batch.farmingMethod}</strong>
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <ExternalLink size={14} color="var(--text-muted)" />
                    {batch.txHash && batch.txHash.startsWith("0x") ? (
                      <a href={`https://sepolia.etherscan.io/tx/${batch.txHash}`} target="_blank" rel="noreferrer"
                        style={{ color: "var(--fern)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        Sepolia On-Chain Proof <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        Sepolia proof unavailable
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* QR Code Section */}
              <div style={{
                background: "rgba(0,0,0,0.35)", padding: "18px", borderRadius: 16,
                border: "1px solid var(--border-glow)", display: "flex", flexDirection: "column",
                alignItems: "center", textAlign: "center", gap: 12, minWidth: 180,
              }}>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  <QrCode size={13} color="var(--fern)" /> Product QR
                </div>

                {qrCode ? (
                  <div style={{
                    background: "#ffffff", padding: "8px", borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <img
                      src={getQRDataUrl()}
                      alt="Batch Verification QR Code"
                      style={{ width: 120, height: 120, display: "block" }}
                    />
                  </div>
                ) : (
                  <div style={{ width: 120, height: 120, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <QrCode size={36} color="var(--text-muted)" />
                  </div>
                )}

                <div style={{ display: "flex", gap: 6, width: "100%" }}>
                  <button className="btn-ghost btn-sm" style={{ flex: 1, padding: "6px 8px", fontSize: "0.75rem", justifyContent: "center" }} onClick={downloadQR}>
                    <Download size={12} /> Save
                  </button>
                  <button className="btn-ghost btn-sm" style={{ flex: 1, padding: "6px 8px", fontSize: "0.75rem", justifyContent: "center" }} onClick={shareLink}>
                    <Share2 size={12} /> Link
                  </button>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", maxWidth: 140 }}>
                  Scannable on consumer packaging at any time
                </span>
              </div>
            </div>
          </div>

          {/* ── Visual Timeline Card ── */}
          <div className="glass-card" style={{ padding: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ScanLine size={22} color="var(--fern)" />
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem" }}>Chain of Custody Lifecycle</h3>
              </div>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                Stage {currentStepNum + 1} of 4 Completed
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>

              {/* ── STAGE 1: HARVEST ── */}
              <div style={{ display: "flex", gap: 20, position: "relative", paddingBottom: 32 }}>
                {/* Vertical Line */}
                <div style={{
                  position: "absolute", left: 19, top: 40, bottom: 0, width: 2,
                  background: currentStepNum >= 1 ? "var(--fern)" : "var(--border)",
                  transition: "background 0.3s ease",
                }} />

                {/* Node */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: "var(--moss)", border: "2px solid var(--fern)",
                  color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 16px var(--glow)", zIndex: 1, flexShrink: 0,
                }}>
                  <Sprout size={18} />
                </div>

                {/* Body */}
                <div style={{ flex: 1, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>1. Harvest & Collection</span>
                        <StatusPill status="CREATED" />
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> Recorded on: {formatDate(batch.harvestDate || batch.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: "0.85rem" }}>
                    <div>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Farm Location</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: "var(--text-primary)" }}>
                        <MapPin size={13} color="var(--fern)" />
                        {/* Show oracle-resolved place name if available, fall back to stored farmLocation string */}
                        {locationByStage.CREATE || batch.farmLocation || "Recorded Farm Site"}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Harvest Quantity</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: "var(--text-primary)" }}>
                        <Scale size={13} color="var(--fern)" />
                        <strong>{batch.quantityKg ?? "—"} kg</strong>
                        {batch.expectedDryWeight && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>(Est. dry: {batch.expectedDryWeight}kg)</span>}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Farmer Identity</span>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 2 }}>
                        {batch.farmerWallet ? `${batch.farmerWallet.slice(0, 10)}…${batch.farmerWallet.slice(-6)}` : "Verified Farmer"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── STAGE 2: LAB TESTING ── */}
              <div style={{ display: "flex", gap: 20, position: "relative", paddingBottom: 32 }}>
                {/* Vertical Line */}
                <div style={{
                  position: "absolute", left: 19, top: 40, bottom: 0, width: 2,
                  background: currentStepNum >= 2 ? "var(--fern)" : "var(--border)",
                  transition: "background 0.3s ease",
                }} />

                {/* Node */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: currentStepNum >= 1 ? "rgba(100,180,255,0.15)" : "transparent",
                  border: `2px solid ${currentStepNum >= 1 ? "#64B4FF" : "var(--border)"}`,
                  color: currentStepNum >= 1 ? "#64B4FF" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: currentStepNum >= 1 ? "0 0 16px rgba(100,180,255,0.2)" : "none",
                  zIndex: 1, flexShrink: 0,
                }}>
                  <FlaskConical size={18} />
                </div>

                {/* Body */}
                <div style={{
                  flex: 1, borderRadius: 14, padding: "20px",
                  background: currentStepNum >= 1 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                  border: `1px solid ${currentStepNum >= 1 ? "var(--border)" : "rgba(255,255,255,0.05)"}`,
                  opacity: currentStepNum >= 1 ? 1 : 0.6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>2. Quality Testing & Certification</span>
                        {currentStepNum >= 1 ? <StatusPill status="TESTED" /> : <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pending</span>}
                        {overallResult && <StatusPill status={overallResult} />}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {lab?.testDate ? formatDate(lab.testDate) : (currentStepNum >= 1 ? "Certified" : "Awaiting laboratory sample")}
                        {locationByStage.TEST && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--fern)", marginLeft: 8 }}>
                            <MapPin size={11} /> {locationByStage.TEST}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {lab ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: "0.82rem" }}>
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>Certificate</span>
                          <div style={{ fontWeight: 600, marginTop: 2 }}>{lab.certificateNumber || "Certified"}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{lab.certifyingBody}</div>
                        </div>

                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>Pesticide / Heavy Metals</span>
                          <div style={{ color: lab.pesticideLevel === "Exceeds Safe Limits" ? "var(--danger)" : "var(--fern)", fontWeight: 500, marginTop: 2 }}>
                            {lab.pesticideLevel || "Not Detected"}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Metals: {lab.heavyMetals || "Safe"}</div>
                        </div>

                        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>Active Compound & Moisture</span>
                          <div style={{ color: "var(--fern)", fontWeight: 600, marginTop: 2 }}>
                            {lab.activeCompound != null ? `${lab.activeCompound}% Active` : "Standardized"}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Moisture: {lab.moistureContent ?? "—"}% · pH {lab.phLevel ?? "—"}</div>
                        </div>
                      </div>

                      {/* Attached Certificate Documents */}
                      {batch.images?.filter(url => url && !url.includes("undefined")).length > 0 && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                          {batch.images.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}>
                              <FileText size={12} /> View Certificate #{i + 1}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Laboratory testing will verify active withanolides/compounds and safety thresholds.
                    </p>
                  )}
                </div>
              </div>

              {/* ── STAGE 3: PROCESSING ── */}
              <div style={{ display: "flex", gap: 20, position: "relative", paddingBottom: 32 }}>
                {/* Vertical Line */}
                <div style={{
                  position: "absolute", left: 19, top: 40, bottom: 0, width: 2,
                  background: currentStepNum >= 3 ? "var(--fern)" : "var(--border)",
                  transition: "background 0.3s ease",
                }} />

                {/* Node */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: currentStepNum >= 2 ? "rgba(255,180,100,0.15)" : "transparent",
                  border: `2px solid ${currentStepNum >= 2 ? "#FFB464" : "var(--border)"}`,
                  color: currentStepNum >= 2 ? "#FFB464" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: currentStepNum >= 2 ? "0 0 16px rgba(255,180,100,0.2)" : "none",
                  zIndex: 1, flexShrink: 0,
                }}>
                  <Settings2 size={18} />
                </div>

                {/* Body */}
                <div style={{
                  flex: 1, borderRadius: 14, padding: "20px",
                  background: currentStepNum >= 2 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                  border: `1px solid ${currentStepNum >= 2 ? "var(--border)" : "rgba(255,255,255,0.05)"}`,
                  opacity: currentStepNum >= 2 ? 1 : 0.6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>3. Processing & Standardization</span>
                        {currentStepNum >= 2 ? <StatusPill status="PROCESSED" /> : <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pending</span>}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {batch.processorData ? (formatDate(batch.updatedAt) || "Processed") : (currentStepNum >= 2 ? "Processed" : "Pending processing handoff")}
                        {locationByStage.PROCESS && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--fern)", marginLeft: 8 }}>
                            <MapPin size={11} /> {locationByStage.PROCESS}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {batch.processorData ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: "0.85rem" }}>
                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Standardized Product</span>
                        <div style={{ fontWeight: 600, marginTop: 2, color: "var(--text-primary)" }}>
                          {batch.processorData.outputProductName || "Finished Extract"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Method: {batch.processorData.processingMethod} ({batch.processorData.solventUsed})
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Output Yield & Ratio</span>
                        <div style={{ marginTop: 2, color: "var(--text-primary)" }}>
                          <strong>{batch.processorData.outputQuantity ?? "—"} kg</strong> · Ratio: {batch.processorData.extractionRatio || "10:1"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Grade: {batch.processorData.qualityGrade} · Active: {batch.processorData.activeCompoundConcentration ?? "—"}%
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Storage & Expiry</span>
                        <div style={{ marginTop: 2, color: "var(--text-primary)" }}>
                          {batch.processorData.storageConditions || "Cool & Dry"}
                        </div>
                        {batch.processorData.expiryDate && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            Expiry: {new Date(batch.processorData.expiryDate).toLocaleDateString("en-IN")}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Processors combine certified raw batches into standardized formulations and link on-chain lineage.
                    </p>
                  )}
                </div>
              </div>

              {/* ── STAGE 4: DISTRIBUTION & RETAIL ── */}
              <div style={{ display: "flex", gap: 20, position: "relative" }}>
                {/* Node */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: currentStepNum >= 3 ? "rgba(180,120,255,0.15)" : "transparent",
                  border: `2px solid ${currentStepNum >= 3 ? "#B478FF" : "var(--border)"}`,
                  color: currentStepNum >= 3 ? "#B478FF" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: currentStepNum >= 3 ? "0 0 16px rgba(180,120,255,0.2)" : "none",
                  zIndex: 1, flexShrink: 0,
                }}>
                  <Truck size={18} />
                </div>

                {/* Body */}
                <div style={{
                  flex: 1, borderRadius: 14, padding: "20px",
                  background: currentStepNum >= 3 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                  border: `1px solid ${currentStepNum >= 3 ? "var(--border)" : "rgba(255,255,255,0.05)"}`,
                  opacity: currentStepNum >= 3 ? 1 : 0.6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>4. Custody Transfer & Retailer Handoff</span>
                        {currentStepNum >= 3 ? <StatusPill status="TRANSFERRED" /> : <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Pending</span>}
                      </div>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {batch.transferData?.dispatchDate ? formatDate(batch.transferData.dispatchDate) : (currentStepNum >= 3 ? "Transferred" : "In transit to distribution hub")}
                        {locationByStage.TRANSFER && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--fern)", marginLeft: 8 }}>
                            <MapPin size={11} /> {locationByStage.TRANSFER}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {batch.transferData ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, fontSize: "0.85rem" }}>
                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Retailer / Destination</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginTop: 2, color: "var(--text-primary)" }}>
                          <Store size={13} color="var(--fern)" />
                          {batch.transferData.retailerName}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {batch.transferData.deliveryLocation}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Shipment & Dispatch</span>
                        <div style={{ marginTop: 2, color: "var(--text-primary)" }}>
                          <strong>{batch.transferData.deliveryQuantity ?? "—"} kg</strong> · {batch.transferData.trackingNumber || "Direct dispatch"}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Expected: {batch.transferData.expectedDeliveryDate ? formatDate(batch.transferData.expectedDeliveryDate) : "Delivered"}
                        </div>
                      </div>

                      <div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase" }}>Cold Chain Compliance</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: batch.transferData.coldChain ? "var(--fern)" : "var(--text-secondary)" }}>
                          <Thermometer size={13} />
                          {batch.transferData.coldChain ? "Maintained (Temp-controlled)" : "Standard Logistics"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Final logistics handoff to certified pharmacy, retailer, or direct dispensary.
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* ── Parent Batch Ingredients (if applicable) ── */}
          {parents.length > 0 && (
            <div className="glass-card" style={{ padding: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <GitBranch size={20} color="var(--fern)" />
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>Raw Ingredient Lineage ({parents.length} Batches)</h3>
              </div>
              <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", marginBottom: 18 }}>
                This finished product was formulated from the following verified raw harvests:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {parents.map((p) => (
                  <div key={p.batchId} className="glass-card" style={{
                    padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    transition: "border-color 0.2s ease, transform 0.15s ease",
                  }} onClick={() => navigate(`/verify/${p.batchId}`)}>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", flex: 1, color: "var(--fern)" }}>{p.batchId}</code>
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{p.herbType}</span>
                    <StatusPill status={p.status} />
                    {p.farmLocation && (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={11} />{p.farmLocation}
                      </span>
                    )}
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}