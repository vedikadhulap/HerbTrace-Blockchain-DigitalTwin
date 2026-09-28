import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Leaf, GitBranch, Sprout, MapPin, Hash, Calendar, Scale,
  Percent, CheckCircle, Plus, ImagePlus, ExternalLink,
  AlertCircle, Loader,
} from "lucide-react";
import api from "../api";
import GPSBar from "../components/GPSBar";
import ErrorCard from "../components/ErrorCard";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

// TODO: Replace hardcoded farmerWallet with req.user.walletAddress after User model
//       gets a walletAddress field and wallet association is built into auth flow
const FARMER_WALLET = "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8";

function PreviewCard({ form, resolvedPlace }) {
  if (!form.herbType) return (
    <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
      <Leaf size={28} color="var(--border-glow)" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
      Fill in the form to see a live preview
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.85rem" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 600 }}>{form.herbType || "\u2014"}</div>
      {form.herbVariety   && <div style={{ color: "var(--text-secondary)" }}>{form.herbVariety}</div>}
      <StatusPill status="CREATED" />
      <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
      {/* Show oracle-resolved place name instead of user-typed location */}
      {resolvedPlace  && <div style={{ display: "flex", gap: 6, color: "var(--text-secondary)" }}><MapPin size={13} />{resolvedPlace}</div>}
      {form.farmingMethod && <div style={{ display: "flex", gap: 6, color: "var(--text-secondary)" }}><Sprout size={13} />{form.farmingMethod}</div>}
      {form.quantityKg    && <div style={{ display: "flex", gap: 6, color: "var(--text-secondary)" }}><Scale size={13} />{form.quantityKg} kg</div>}
      {form.harvestDate   && <div style={{ display: "flex", gap: 6, color: "var(--text-secondary)" }}><Calendar size={13} />{new Date(form.harvestDate).toLocaleDateString("en-IN")}</div>}
    </div>
  );
}

export default function CreateBatch() {
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [coords, setCoords]       = useState(null);
  // resolvedPlace is set by a quick client-side Nominatim call once GPS coords arrive.
  // It's used for (a) the read-only location banner and (b) populating farmLocation on submit.
  // Coordinates themselves are NEVER shown in the UI.
  const [resolvedPlace, setResolvedPlace] = useState(null);
  const [resolvingPlace, setResolvingPlace] = useState(false);

  const [form, setForm]         = useState({
    herbType: "", herbVariety: "", farmingMethod: "",
    lotNumber: "", harvestDate: "", quantityKg: "", estimatedMoisture: "", expectedDryWeight: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);
  const [createdBatch, setCreatedBatch] = useState(null);
  const [imageFile, setImageFile]   = useState(null);
  const [imageUrl, setImageUrl]     = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [toast, setToast]           = useState(null);

  // Quick client-side reverse-geocode for display only.
  // The actual multi-oracle verification still happens server-side on submit.
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
    if (!form.herbType || !form.farmingMethod || !form.harvestDate || !form.quantityKg) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true); setError(null);
    const batchId = `${form.herbType.toUpperCase().replace(/\s+/g, "")}-${Date.now()}`;
    // farmLocation is populated from the oracle-resolved place name (not user-typed)
    // If GPS wasn't available, send empty string — backend handles it gracefully
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
    setCreatedBatch(null); setForm({ herbType: "", herbVariety: "", farmingMethod: "",
      lotNumber: "", harvestDate: "", quantityKg: "",
      estimatedMoisture: "", expectedDryWeight: "" });
    setError(null); setImageFile(null); setImageUrl(null);
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 4 }}>Create Batch</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Record a new herb harvest on-chain. All fields marked with * are required.
        </p>
      </div>

      <GPSBar onCoordsChange={handleCoordsChange} />

      {/* Read-only location banner — shown once oracle resolves a place name */}
      {(resolvingPlace || resolvedPlace) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 10, marginBottom: 20,
          background: resolvedPlace ? "var(--fern-dim)" : "rgba(255,255,255,0.02)",
          border: `1px solid ${resolvedPlace ? "var(--border-glow)" : "var(--border)"}`,
          fontSize: "0.85rem",
        }}>
          <MapPin size={14} color="var(--fern)" />
          {resolvingPlace
            ? <span style={{ color: "var(--text-muted)" }}>Resolving location…</span>
            : <span>Detected location: <strong style={{ color: "var(--text-primary)" }}>{resolvedPlace}</strong></span>
          }
        </div>
      )}

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
        /* ── Two-column form ── */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>
          <form onSubmit={handleSubmit} className="glass-card" style={{ padding: "28px 28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div className="field-group">
                <label className="field-label"><Leaf size={14} /> Herb Type *</label>
                <input className="field-input" type="text" placeholder="e.g. Ashwagandha" required {...field("herbType")} />
              </div>

              <div className="field-group">
                <label className="field-label"><GitBranch size={14} /> Herb Variety / Cultivar</label>
                <input className="field-input" type="text" placeholder="e.g. KS-100, KSM-66" {...field("herbVariety")} />
              </div>

              <div className="field-group">
                <label className="field-label"><Sprout size={14} /> Farming Method *</label>
                <select className="field-select" required {...field("farmingMethod")}>
                  <option value="">Select method…</option>
                  <option>Organic</option>
                  <option>Conventional</option>
                  <option>Biodynamic</option>
                  <option>Wildcrafted</option>
                </select>
              </div>

              {/* Farm Location is now captured automatically via GPS + oracle.
                  The read-only banner at the top of the page shows the resolved name.
                  No manual input field — location is never user-editable. */}

              <div className="field-group">
                <label className="field-label"><Hash size={14} /> Lot / Field Number</label>
                <input className="field-input" type="text" placeholder="e.g. FIELD-A3" {...field("lotNumber")} />
              </div>

              <div className="field-group">
                <label className="field-label"><Calendar size={14} /> Harvest Date *</label>
                <input className="field-input" type="date" required {...field("harvestDate")} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="field-group">
                  <label className="field-label"><Scale size={14} /> Quantity (kg) *</label>
                  <input className="field-input" type="number" min="0.1" step="0.1" required
                    placeholder="e.g. 250" {...field("quantityKg")} />
                </div>
                <div className="field-group">
                  <label className="field-label"><Percent size={14} /> Est. Moisture (%)</label>
                  <input className="field-input" type="number" min="0" max="100" step="0.1"
                    placeholder="e.g. 12" {...field("estimatedMoisture")} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label"><Scale size={14} /> Expected Dry Weight (kg)</label>
                <input className="field-input" type="number" min="0.1" step="0.1"
                  placeholder="e.g. 200" {...field("expectedDryWeight")} />
              </div>

              <ErrorCard error={error} />

              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                {submitting ? "Creating on-chain…" : "Create Batch"}
              </button>
            </div>
          </form>

          {/* Live Preview */}
          <div className="glass-card" style={{ padding: "22px 20px", position: "sticky", top: 80 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", letterSpacing: "0.06em",
              textTransform: "uppercase", fontWeight: 600, marginBottom: 14, display: "flex", gap: 6 }}>
              <AlertCircle size={12} /> Live Preview
            </div>
            <PreviewCard form={form} resolvedPlace={resolvedPlace} />
          </div>
        </div>
      )}
    </div>
  );
}