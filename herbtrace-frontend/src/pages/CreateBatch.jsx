import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";

// TODO: Replace hardcoded wallet with req.user.walletAddress once
// wallet association is added to the User model
const FARMER_WALLET = "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8";

function useGPS() {
  const [coords, setCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("getting");

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsStatus("captured");
      },
      () => setGpsStatus("unavailable")
    );
  }, []);

  return { coords, gpsStatus };
}

const GPS_LABEL = {
  getting:     { icon: "📍", text: "Getting your location…",                          color: "var(--paper-dim)" },
  captured:    { icon: "📍", text: null, /* coordinates shown inline */              color: "var(--fern-glow)" },
  unavailable: { icon: "📍", text: "Location unavailable — proceeding without GPS",  color: "#E8A87C" },
};

function GpsLine({ coords, gpsStatus }) {
  const info = GPS_LABEL[gpsStatus];
  return (
    <div className="gps-line" style={{ color: info.color }}>
      <span>{info.icon}</span>
      <span>
        {gpsStatus === "captured" && coords
          ? `Location captured (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
          : info.text}
      </span>
    </div>
  );
}

async function uploadFile(batchId, file) {
  const fd = new FormData();
  fd.append("batchId", batchId);
  fd.append("image", file);
  // TODO: protect /batch/upload-image with protect() for any authenticated role
  const res = await api.post("/batch/upload-image", fd);
  return res.data;
}

function CreateBatch() {
  const [form, setForm] = useState({ herbType: "", farmLocation: "", harvestDate: "", quantityKg: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [created, setCreated]   = useState(null);

  // File upload state for the success card
  const [uploadFile_state, setUploadFileState] = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const { coords, gpsStatus } = useGPS();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreated(null);

    const batchId = `${form.herbType.toUpperCase().replace(/\s+/g, "")}-${Date.now()}`;

    try {
      const res = await api.post("/batch", {
        ...form,
        batchId,
        farmerWallet: FARMER_WALLET,
        quantityKg: Number(form.quantityKg),
        // Always send coords — null if GPS unavailable (backend handles gracefully)
        latitude:  coords?.latitude  ?? null,
        longitude: coords?.longitude ?? null,
      });
      setCreated(res.data);
      setForm({ herbType: "", farmLocation: "", harvestDate: "", quantityKg: "" });
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (!uploadFile_state || !created) return;
    setUploading(true);
    setUploadError(null);
    try {
      const updated = await uploadFile(created.batchId, uploadFile_state);
      const url = updated.images?.slice(-1)[0] || "";
      setUploadedUrl(url);
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Create Batch</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>Record a new harvest on-chain.</p>

        <GpsLine coords={coords} gpsStatus={gpsStatus} />

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label className="field-label">Herb type</label>
            <input className="field-input" type="text" name="herbType" value={form.herbType}
              onChange={e => setForm({ ...form, herbType: e.target.value })}
              placeholder="e.g. Ashwagandha" required />
          </div>
          <div>
            <label className="field-label">Farm location</label>
            <input className="field-input" type="text" name="farmLocation" value={form.farmLocation}
              onChange={e => setForm({ ...form, farmLocation: e.target.value })}
              placeholder="e.g. Nashik, Maharashtra" required />
          </div>
          <div>
            <label className="field-label">Harvest date</label>
            <input className="field-input" type="date" name="harvestDate" value={form.harvestDate}
              onChange={e => setForm({ ...form, harvestDate: e.target.value })} required />
          </div>
          <div>
            <label className="field-label">Quantity (kg)</label>
            <input className="field-input" type="number" name="quantityKg" value={form.quantityKg}
              onChange={e => setForm({ ...form, quantityKg: e.target.value })}
              placeholder="e.g. 50" required min="0.1" step="0.1" />
          </div>

          {error && <p style={{ color: "#E8A87C", fontSize: "0.88rem", margin: 0 }}>{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}
            style={{ marginTop: 4, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Writing to chain…" : "Create Batch"}
          </button>
        </form>
      </div>

      {created && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 20 }}>
          <span className="status-pill">CREATED</span>
          <h2 style={{ fontSize: "1.3rem", marginTop: 12 }}>{created.herbType}</h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.83rem", color: "var(--paper-dim)", marginTop: 6 }}>
            {created.batchId}
          </p>
          {created.location?.latitude != null && (
            <p style={{ fontSize: "0.78rem", color: "var(--paper-dim)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
              📍 {created.location.latitude.toFixed(5)}, {created.location.longitude.toFixed(5)}
            </p>
          )}

          <Link to={`/verify/${created.batchId}`} style={{ color: "var(--fern-glow)", fontSize: "0.88rem", display: "inline-block", marginTop: 14, textDecoration: "underline" }}>
            View full batch →
          </Link>

          {/* Photo upload */}
          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--glass-border)" }}>
            <label className="field-label">Upload a farm photo (optional)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="file" accept="image/*" onChange={e => setUploadFileState(e.target.files[0])}
                className="field-input" style={{ flex: 1, padding: "9px 14px", cursor: "pointer" }} />
              {uploadFile_state && !uploadedUrl && (
                <button onClick={handlePhotoUpload} disabled={uploading} className="btn-primary"
                  style={{ fontSize: "0.85rem", padding: "10px 18px", opacity: uploading ? 0.6 : 1 }}>
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              )}
            </div>
            {uploadedUrl && (
              <div style={{ marginTop: 10 }}>
                <img src={uploadedUrl} alt="Uploaded farm photo"
                  style={{ maxWidth: 200, borderRadius: 10, marginBottom: 8 }} />
                <a href={uploadedUrl} target="_blank" rel="noreferrer"
                  style={{ color: "var(--fern-glow)", fontSize: "0.82rem", display: "block", textDecoration: "underline" }}>
                  View on IPFS ↗
                </a>
              </div>
            )}
            {uploadError && <p style={{ color: "#E8A87C", fontSize: "0.82rem", marginTop: 6 }}>{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateBatch;