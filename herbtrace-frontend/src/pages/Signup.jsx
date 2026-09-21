import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sprout, FlaskConical, Settings2, Truck,
  Upload, CheckCircle, User, Mail, Lock, Eye, EyeOff,
  FileText, Award, Building2, AlertCircle, ArrowRight,
  ChevronLeft, Phone, MapPin,
} from "lucide-react";
import api from "../api";

const ROLES = [
  { key: "farmer",      label: "Farmer",      icon: Sprout,       desc: "Record and verify harvests" },
  { key: "lab",         label: "Lab",         icon: FlaskConical, desc: "Certify batch quality" },
  { key: "processor",   label: "Processor",   icon: Settings2,    desc: "Process and combine batches" },
  { key: "distributor", label: "Distributor", icon: Truck,        desc: "Transfer custody to retailers" },
];

const PROOF_LABELS = {
  farmer:      { icon: FileText,  text: "Upload Kisan ID or land ownership papers" },
  lab:         { icon: Award,     text: "Upload NABL or accreditation certificate" },
  processor:   { icon: Building2, text: "Upload business registration or GST certificate" },
  distributor: { icon: Truck,     text: "Upload distribution or logistics license" },
};

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal","Andaman & Nicobar Islands","Chandigarh","Dadra & Nagar Haveli",
  "Daman & Diu","Delhi","Jammu & Kashmir","Ladakh","Lakshadweep","Puducherry","Other",
];

function StepBar({ step }) {
  return (
    <div className="step-bar" style={{ marginBottom: 28 }}>
      <div className="step-segment">
        <div className={`step-dot ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`}>1</div>
        <div className={`step-label ${step === 1 ? "active" : ""}`}>Role & Proof</div>
      </div>
      <div className={`step-connector ${step > 1 ? "done" : ""}`} />
      <div className="step-segment">
        <div className={`step-dot ${step === 2 ? "active" : ""}`}>2</div>
        <div className={`step-label ${step === 2 ? "active" : ""}`}>Account Details</div>
      </div>
    </div>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [step, setStep]           = useState(1);
  const [selectedRole, setRole]   = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [proofUrl, setProofUrl]   = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | uploading | done | error

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    phone: "", organizationName: "", state: "",
  });
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  /* ── Step 1: upload proof ────────── */
  const uploadFile = async (file) => {
    if (!file) return;
    setProofFile(file);
    setUploadStatus("uploading");
    setError(null);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await api.post("/batch/upload-direct", fd);
      setProofUrl(res.data.ipfsUrl);
      setUploadStatus("done");
    } catch (err) {
      setUploadStatus("error");
      setError(err.response?.data?.error || "Document upload failed. Make sure the backend server is running.");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  /* ── Step 2: create account ──────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proofUrl) { setError("Proof document URL missing."); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!form.organizationName) { setError("Organization / Farm Name is required."); return; }

    setSubmitting(true); setError(null);
    try {
      await api.post("/auth/signup", {
        name:             form.name,
        email:            form.email,
        password:         form.password,
        phone:            form.phone,
        organizationName: form.organizationName,
        state:            form.state,
        role:             selectedRole,
        proofDocumentUrl: proofUrl,
      });
      navigate("/pending", { state: { role: selectedRole } });
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const proofInfo = selectedRole ? PROOF_LABELS[selectedRole] : null;
  const field = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

  return (
    <div style={{ maxWidth: 600, margin: "40px auto" }}>
      <div className="glass-card" style={{ padding: "40px 36px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 6 }}>Join HerbTrace</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 28 }}>
          Partners need approval before accessing the platform.
        </p>

        <StepBar step={step} />

        {/* ── STEP 1 ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="fade-in-up">
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 14 }}>Select your role:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {ROLES.map(r => (
                <button key={r.key} onClick={() => setRole(r.key)} style={{
                  padding: "16px 14px", borderRadius: 14, cursor: "pointer",
                  border: `1px solid ${selectedRole === r.key ? "var(--fern)" : "var(--border)"}`,
                  background: selectedRole === r.key ? "var(--fern-dim)" : "var(--bg-card)",
                  boxShadow: selectedRole === r.key ? "0 0 20px var(--glow)" : "none",
                  transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
                  color: "var(--text-primary)", textAlign: "left",
                }}>
                  <r.icon size={20} color={selectedRole === r.key ? "var(--fern)" : "var(--text-secondary)"} />
                  <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{r.label}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{r.desc}</div>
                </button>
              ))}
            </div>

            {selectedRole && (
              <div style={{ marginBottom: 20 }}>
                <label className="field-label" style={{ marginBottom: 12 }}>
                  {proofInfo && <proofInfo.icon size={13} />}
                  {proofInfo?.text}
                </label>

                {uploadStatus === "done" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "var(--fern-dim)", border: "1px solid var(--border-glow)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fern)", fontSize: "0.88rem" }}>
                      <CheckCircle size={16} />
                      <span style={{ fontWeight: 500 }}>{proofFile?.name}</span>
                      <a href={proofUrl} target="_blank" rel="noreferrer"
                        style={{ color: "var(--sage)", fontSize: "0.78rem", marginLeft: 4 }}>
                        View on IPFS
                      </a>
                    </div>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => { setProofFile(null); setProofUrl(null); setUploadStatus("idle"); }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <div
                    className="upload-zone"
                    onClick={() => fileRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    style={{ gap: 10, flexDirection: "column", display: "flex", alignItems: "center", cursor: "pointer" }}
                  >
                    <Upload size={24} color="var(--fern)" className={uploadStatus === "uploading" ? "spin" : ""} />
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {uploadStatus === "uploading" ? "Uploading document to IPFS…" : (proofFile ? proofFile.name : "Click to browse or drag & drop")}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Accepts: image, PDF</span>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                      onChange={handleFileChange} />
                  </div>
                )}

                {uploadStatus === "error" && (
                  <div className="error-generic" style={{ marginTop: 10 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            <button className="btn-primary" style={{ width: "100%" }}
              disabled={uploadStatus !== "done"}
              onClick={() => { setStep(2); setError(null); }}>
              <ArrowRight size={16} /> Continue to Step 2
            </button>
          </div>
        )}

        {/* ── STEP 2 ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="fade-in-up">
            <button className="btn-ghost btn-sm" style={{ marginBottom: 20 }} onClick={() => setStep(1)}>
              <ChevronLeft size={14} /> Back
            </button>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Full Name */}
              <div className="field-group">
                <label className="field-label"><User size={13} /> Full Name</label>
                <div className="field-input-wrapper">
                  <User size={15} className="input-icon" />
                  <input className="field-input" type="text" required placeholder="Your full name" {...field("name")} />
                </div>
              </div>

              {/* Email */}
              <div className="field-group">
                <label className="field-label"><Mail size={13} /> Email</label>
                <div className="field-input-wrapper">
                  <Mail size={15} className="input-icon" />
                  <input className="field-input" type="email" required placeholder="you@example.com" {...field("email")} />
                </div>
              </div>

              {/* Password */}
              <div className="field-group">
                <label className="field-label"><Lock size={13} /> Password</label>
                <div className="field-input-wrapper">
                  <Lock size={15} className="input-icon" />
                  <input className="field-input" type={showPw ? "text" : "password"} required minLength={8}
                    placeholder="Min. 8 characters" {...field("password")} />
                  <button type="button" className="input-icon-right" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="field-group">
                <label className="field-label"><Lock size={13} /> Confirm Password</label>
                <div className="field-input-wrapper">
                  <Lock size={15} className="input-icon" />
                  <input className="field-input" type={showConfirm ? "text" : "password"} required
                    placeholder="Re-enter password" {...field("confirmPassword")} />
                  <button type="button" className="input-icon-right" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Phone (optional) */}
              <div className="field-group">
                <label className="field-label"><Phone size={13} /> Phone Number <span style={{ color: "var(--text-muted)", textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>(mandatory)</span></label>
                <div className="field-input-wrapper">
                  <Phone size={15} className="input-icon" />
                  <input className="field-input" type="tel" placeholder="+91 98765 43210" {...field("phone")} />
                </div>
              </div>

              {/* Organization / Farm Name */}
              <div className="field-group">
                <label className="field-label"><Building2 size={13} /> Organization / Farm Name</label>
                <div className="field-input-wrapper">
                  <Building2 size={15} className="input-icon" />
                  <input className="field-input" type="text" required
                    placeholder={selectedRole === "farmer" ? "e.g. Green Fields Farm" : "e.g. Ayurvedic Labs Pvt Ltd"}
                    {...field("organizationName")} />
                </div>
              </div>

              {/* State */}
              <div className="field-group">
                <label className="field-label"><MapPin size={13} /> State / Region</label>
                <select className="field-select" {...field("state")}>
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {error && (
                <div className="error-generic">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: 4 }}>
                <CheckCircle size={16} /> {submitting ? "Creating account…" : "Create Account"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
