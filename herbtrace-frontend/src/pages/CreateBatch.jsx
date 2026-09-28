import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf, GitBranch, MapPin, Hash, Calendar, Scale,
  CheckCircle, Plus, ImagePlus, ExternalLink,
  Loader, Check, ShieldCheck, Layers,
} from "lucide-react";
import api from "../api";
import GPSBar from "../components/GPSBar";
import ErrorCard from "../components/ErrorCard";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

// TODO: Replace hardcoded farmerWallet with req.user.walletAddress after User model
//       gets a walletAddress field and wallet association is built into auth flow
const FARMER_WALLET = "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8";

export default function CreateBatch() {
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [coords, setCoords]               = useState(null);
  const [resolvedPlace, setResolvedPlace] = useState(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);

  const [form, setForm]         = useState({
    herbType: "",
    herbVariety: "",
    lotNumber: "",
    harvestDate: "",
    quantityKg: "",
  });
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);
  const [createdBatch, setCreatedBatch] = useState(null);
  const [imageFile, setImageFile]       = useState(null);
  const [imageUrl, setImageUrl]         = useState(null);
  const [uploading, setUploading]       = useState(false);
  const [toast, setToast]               = useState(null);

  const resolveFromCoords = async (c) => {
    if (!c) return;
    setResolvingPlace(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${c.latitude}&lon=${c.longitude}&format=json`;
      const resp = await fetch(url, { headers: { "User-Agent": "HerbTrace/1.0" } });
      const data = await resp.json();
      const city  = data.address?.city || data.address?.town || data.address?.village || "";
      const state = data.address?.state || "";
      const place = [city, state].filter(Boolean).join(", ") || data.display_name?.split(",")[0] || "Unknown location";
      setResolvedPlace(place);
    } catch {
      setResolvedPlace(null);
    } finally {
      setResolvingPlace(false);
    }
  };

  const handleCoordsChange = (c) => {
    setCoords(c);
    resolveFromCoords(c);
  };

  const field = (key) => ({
    value: form[key],
    onChange: e => setForm({ ...form, [key]: e.target.value }),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.herbType || !form.harvestDate || !form.quantityKg) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const batchId = `${form.herbType.toUpperCase().replace(/\s+/g, "")}-${Date.now()}`;
    const farmLocation = resolvedPlace || "";

    try {
      const res = await api.post("/batch", {
        ...form,
        farmLocation,
        batchId,
        farmerWallet: FARMER_WALLET,
        latitude:  coords?.latitude  ?? 0,
        longitude: coords?.longitude ?? 0,
      });
      setCreatedBatch(res.data);
      setToast({ message: "Batch created on-chain!", type: "success" });
    } catch (err) {
      setError(err.response?.data?.error || "Batch creation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async () => {
    if (!imageFile || !createdBatch) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("batchId", createdBatch.batchId);
    fd.append("image", imageFile);
    try {
      const res = await api.post("/batch/upload-image", fd);
      const imgs = res.data.images;
      setImageUrl(imgs[imgs.length - 1]);
      setToast({ message: "Photo uploaded!", type: "success" });
    } catch {
      setToast({ message: "Upload failed.", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setCreatedBatch(null);
    setForm({
      herbType: "",
      herbVariety: "",
      lotNumber: "",
      harvestDate: "",
      quantityKg: "",
    });
    setError(null);
    setImageFile(null);
    setImageUrl(null);
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 12px" }}>
      <style>{`
        .create-batch-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .create-batch-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 4 }}>Create Batch</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Record a new herb harvest on-chain. All fields marked with * are required.
        </p>
      </div>

      {createdBatch ? (
        /* ── Success Card ── */
        <div className="glass-card fade-in" style={{ padding: "40px 36px", textAlign: "center" }}>
          <CheckCircle size={36} color="var(--fern)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", marginBottom: 8 }}>Batch Created</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>{createdBatch.batchId}</code>
            <StatusPill status="CREATED" />
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <button className="btn-primary" onClick={() => navigate(`/verify/${createdBatch.batchId}`)}>
              <ExternalLink size={14} /> View on Verify Page
            </button>
            <button className="btn-ghost" onClick={resetForm}>
              <Plus size={14} /> Create Another Batch
            </button>
          </div>

          {/* Image upload zone */}
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>
              Optionally add a farm photo or document:
            </p>
            {imageUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", color: "var(--fern)" }}>
                <CheckCircle size={16} />
                <a href={imageUrl} target="_blank" rel="noreferrer" style={{ color: "var(--fern)", fontSize: "0.85rem" }}>
                  View on IPFS
                </a>
              </div>
            ) : (
              <>
                <div className="upload-zone" onClick={() => fileRef.current?.click()} style={{ flexDirection: "column" }}>
                  <ImagePlus size={22} color="var(--fern)" />
                  <span style={{ fontSize: "0.85rem" }}>{imageFile ? imageFile.name : "Add farm photo or document"}</span>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                    onChange={e => setImageFile(e.target.files[0])} />
                </div>
                {imageFile && (
                  <button className="btn-ghost btn-sm" style={{ marginTop: 10 }}
                    onClick={handleImageUpload} disabled={uploading}>
                    {uploading ? <Loader size={13} className="spin" /> : <ImagePlus size={13} />}
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Two-column layout ── */
        <div className="create-batch-grid">
          {/* LEFT COLUMN: Simplified Create Batch Form */}
          <form onSubmit={handleSubmit} className="glass-card" style={{ padding: "28px 28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Herb Type * */}
              <div className="field-group">
                <label className="field-label"><Leaf size={14} /> Herb Type *</label>
                <input className="field-input" type="text" placeholder="e.g. Tulsi" required {...field("herbType")} />
              </div>

              {/* Herb Variety / Cultivar (optional) */}
              <div className="field-group">
                <label className="field-label"><GitBranch size={14} /> Herb Variety / Cultivar</label>
                <input className="field-input" type="text" placeholder="e.g. KSM-66" {...field("herbVariety")} />
              </div>

              {/* Lot / Field Number (optional) */}
              <div className="field-group">
                <label className="field-label"><Hash size={14} /> Lot / Field Number</label>
                <input className="field-input" type="text" placeholder="e.g. FIELD-A3" {...field("lotNumber")} />
              </div>

              {/* Harvest Date * & Quantity (kg) * */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="field-group">
                  <label className="field-label"><Calendar size={14} /> Harvest Date *</label>
                  <input className="field-input" type="date" required {...field("harvestDate")} />
                </div>
                <div className="field-group">
                  <label className="field-label"><Scale size={14} /> Quantity (kg) *</label>
                  <input className="field-input" type="number" min="0.1" step="0.1" required
                    placeholder="e.g. 250" {...field("quantityKg")} />
                </div>
              </div>

              {/* Location Section */}
              <div style={{
                padding: "16px", borderRadius: 14,
                background: "var(--fern-dim)", border: "1px solid var(--border-glow)",
                display: "flex", flexDirection: "column", gap: 8
              }}>
                <div style={{
                  fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em",
                  color: "var(--fern)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6
                }}>
                  <MapPin size={14} /> FARM LOCATION
                </div>

                <GPSBar onCoordsChange={handleCoordsChange} />

                <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  {resolvingPlace ? (
                    <span style={{ color: "var(--text-muted)" }}>Resolving location details…</span>
                  ) : resolvedPlace ? (
                    <span>📍 Location: <strong style={{ color: "var(--text-primary)" }}>{resolvedPlace}</strong></span>
                  ) : (
                    <span>📍 Location will be captured automatically</span>
                  )}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {coords ? "Ready for location verification" : "GPS coordinates captured silently on browser consent"}
                </div>
              </div>

              <ErrorCard error={error} />

              <button type="submit" className="btn-primary" disabled={submitting} style={{ marginTop: 6, justifyContent: "center" }}>
                {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                {submitting ? "Creating on-chain…" : "Create Batch"}
              </button>
            </div>
          </form>

          {/* RIGHT COLUMN: Informational Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* CARD 1 — TRACEABILITY JOURNEY */}
            <div className="glass-card" style={{ padding: "24px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ padding: 6, borderRadius: 8, background: "var(--fern-dim)", color: "var(--fern)", display: "flex" }}>
                  <Layers size={18} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.02em" }}>
                  TRACEABILITY JOURNEY
                </h3>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: 20, marginTop: 4 }}>
                Track the batch through every supply-chain stage.
              </p>

              {/* Vertical Timeline */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingLeft: 4 }}>
                {/* Stage 1: CREATE (Active) */}
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      background: "var(--fern)", border: "3px solid var(--bg-secondary)",
                      boxShadow: "0 0 10px var(--fern)", zIndex: 2
                    }} />
                    <div style={{ width: 2, flexGrow: 1, background: "var(--border-glow)", marginTop: 2, marginBottom: 2, minHeight: 28 }} />
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--fern)" }}>CREATE</span>
                      <span style={{ fontSize: "0.68rem", padding: "2px 8px", borderRadius: 10, background: "var(--fern-dim)", color: "var(--fern)", fontWeight: 600 }}>Active</span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 2 }}>Batch origin registered</div>
                  </div>
                </div>

                {/* Stage 2: LAB TEST */}
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: "transparent", border: "2px solid var(--text-muted)",
                      zIndex: 2, marginTop: 1
                    }} />
                    <div style={{ width: 2, flexGrow: 1, background: "var(--border)", marginTop: 2, marginBottom: 2, minHeight: 28 }} />
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-muted)" }}>LAB TEST</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>Quality information recorded</div>
                  </div>
                </div>

                {/* Stage 3: PROCESS */}
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: "transparent", border: "2px solid var(--text-muted)",
                      zIndex: 2, marginTop: 1
                    }} />
                    <div style={{ width: 2, flexGrow: 1, background: "var(--border)", marginTop: 2, marginBottom: 2, minHeight: 28 }} />
                  </div>
                  <div style={{ paddingBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-muted)" }}>PROCESS</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>Transformation and lineage recorded</div>
                  </div>
                </div>

                {/* Stage 4: TRANSFER */}
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      background: "transparent", border: "2px solid var(--text-muted)",
                      zIndex: 2, marginTop: 1
                    }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-muted)" }}>TRANSFER</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>Custody and final verification recorded</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2 — BLOCKCHAIN PROTECTION */}
            <div className="glass-card" style={{ padding: "24px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: 6, borderRadius: 8, background: "var(--fern-dim)", color: "var(--fern)", display: "flex" }}>
                  <ShieldCheck size={18} />
                </div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.02em" }}>
                  BLOCKCHAIN PROTECTION
                </h3>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Batch identity",
                  "Origin information",
                  "GPS-based location verification",
                  "Cryptographic integrity",
                  "Traceable batch lineage",
                ].map((item, idx) => (
                  <li key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: "var(--fern-dim)", color: "var(--fern)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div style={{
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
                fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", lineHeight: "1.4"
              }}>
                Your batch will enter the supply chain as the <strong style={{ color: "var(--fern)" }}>CREATED</strong> stage.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}