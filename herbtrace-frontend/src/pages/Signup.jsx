import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

const ROLES = [
  { value: "farmer",      label: "Farmer",      icon: "🌿", proof: "Upload Kisan ID or land ownership papers" },
  { value: "lab",         label: "Lab",          icon: "🧪", proof: "Upload lab accreditation certificate" },
  { value: "processor",   label: "Processor",    icon: "⚙️", proof: "Upload business registration or GST certificate" },
  { value: "distributor", label: "Distributor",  icon: "🚚", proof: "Upload distribution or logistics license" },
];

const ROLE_HOME = {
  farmer: "/create-batch", lab: "/lab-test", processor: "/process-batch", distributor: "/transfer",
};

function Signup() {
  const navigate = useNavigate();

  // Read ?role= from URL so Home role cards pre-select the role
  const params = new URLSearchParams(window.location.search);
  const urlRole = params.get("role");

  const [step, setStep]               = useState(1);
  const [selectedRole, setSelectedRole] = useState(urlRole || null);
  const [proofFile, setProofFile]     = useState(null);
  const [proofUrl, setProofUrl]       = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | uploading | done | error
  const [form, setForm]               = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState(null);

  const handleFileChange = (e) => {
    setProofFile(e.target.files[0]);
    setProofUrl(null);
    setUploadStatus("idle");
  };

  const handleUpload = async () => {
    if (!selectedRole) { setError("Please select a role first."); return; }
    if (!proofFile)    { setError("Please select a file to upload."); return; }
    setError(null);
    setUploadStatus("uploading");

    const fd = new FormData();
    fd.append("batchId", "signup-proof");
    fd.append("image", proofFile);

    try {
      const res = await api.post("/batch/upload-image", fd);
      // The endpoint returns the updated batch — grab the last image URL
      const url = res.data?.images?.slice(-1)[0] || res.data?.ipfsUrl || "";
      setProofUrl(url);
      setUploadStatus("done");
    } catch (err) {
      setUploadStatus("error");
      setError("Upload failed. Try again or check your connection.");
    }
  };

  const goToStep2 = () => {
    if (!selectedRole)         { setError("Select a role."); return; }
    if (uploadStatus !== "done") { setError("Upload your proof document first."); return; }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post("/auth/signup", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: selectedRole,
        proofDocumentUrl: proofUrl,
      });
      navigate("/pending");
    } catch (err) {
      setError(err.response?.data?.error || "Signup failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="glass-panel" style={{ padding: "40px" }}>
        {/* Step indicator */}
        <div className="step-indicator">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>1</div>
          <div className="step-line" />
          <div className={`step-dot ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>2</div>
          <span className="step-label" style={{ marginLeft: 10 }}>
            {step === 1 ? "Upload proof document" : "Create your account"}
          </span>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>Join HerbTrace</h1>
            <p style={{ color: "var(--paper-dim)", fontSize: "0.88rem", marginBottom: 28 }}>
              New accounts are reviewed by an admin before access is granted.
            </p>

            {/* Role selector cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {ROLES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { setSelectedRole(r.value); setError(null); }}
                  style={{
                    padding: "16px 12px",
                    borderRadius: 14,
                    border: selectedRole === r.value
                      ? "1.5px solid var(--moss)"
                      : "1px solid var(--glass-border)",
                    background: selectedRole === r.value ? "rgba(61,107,79,0.2)" : "var(--glass)",
                    color: "var(--paper)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                >
                  <div style={{ fontSize: "1.3rem", marginBottom: 6 }}>{r.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.label}</div>
                </button>
              ))}
            </div>

            {/* Proof document upload */}
            {selectedRole && (
              <div style={{ marginBottom: 20 }}>
                <label className="field-label">
                  {ROLES.find(r => r.value === selectedRole)?.proof}
                </label>
                <input
                  id="signup-proof"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="field-input"
                  style={{ padding: "10px 14px", cursor: "pointer" }}
                />
                {proofFile && uploadStatus !== "done" && (
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploadStatus === "uploading"}
                    className="btn-primary"
                    style={{ marginTop: 10, fontSize: "0.88rem", padding: "10px 20px", opacity: uploadStatus === "uploading" ? 0.6 : 1 }}
                  >
                    {uploadStatus === "uploading" ? "Uploading to IPFS…" : "Upload document"}
                  </button>
                )}
                {uploadStatus === "done" && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--fern-glow)", fontSize: "0.85rem" }}>✓ Uploaded</span>
                    <a href={proofUrl} target="_blank" rel="noreferrer"
                      style={{ color: "var(--fern-glow)", fontSize: "0.8rem", textDecoration: "underline" }}>
                      View file ↗
                    </a>
                  </div>
                )}
                {uploadStatus === "error" && (
                  <p style={{ color: "#E8A87C", fontSize: "0.82rem", marginTop: 6 }}>Upload failed. Try again.</p>
                )}
              </div>
            )}

            {error && <p style={{ color: "#E8A87C", fontSize: "0.85rem", marginBottom: 12 }}>{error}</p>}

            <button type="button" onClick={goToStep2} className="btn-primary" style={{ width: "100%" }}>
              Continue →
            </button>

            <p style={{ marginTop: 22, fontSize: "0.85rem", color: "var(--paper-dim)", textAlign: "center" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ color: "var(--fern-glow)", textDecoration: "underline" }}>Sign in</Link>
            </p>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>Create your account</h1>
            <p style={{ color: "var(--paper-dim)", fontSize: "0.88rem", marginBottom: 28 }}>
              Signing up as <strong style={{ color: "var(--fern-glow)", textTransform: "capitalize" }}>{selectedRole}</strong>.
              Proof document uploaded ✓
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label className="field-label">Full name</label>
                <input id="signup-name" type="text" className="field-input"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Priya Sharma" required />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input id="signup-email" type="email" className="field-input"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com" required autoComplete="email" />
              </div>
              <div>
                <label className="field-label">Password</label>
                <input id="signup-password" type="password" className="field-input"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
              </div>

              {error && <p style={{ color: "#E8A87C", fontSize: "0.85rem", margin: 0 }}>{error}</p>}

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setStep(1)} className="btn-outline" style={{ flex: "0 0 auto" }}>
                  ← Back
                </button>
                <button id="signup-submit" type="submit" className="btn-primary"
                  disabled={submitting} style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Signup;
