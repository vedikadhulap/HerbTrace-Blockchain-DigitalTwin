import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Hash, Search, CheckCircle, Info, MapPin, Scale, Calendar,
  AlignLeft, FileText, Upload, Loader, Store, Thermometer,
  ExternalLink,
} from "lucide-react";
import api from "../api";
import GPSBar from "../components/GPSBar";
import ErrorCard from "../components/ErrorCard";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

export default function TransferCustody() {
  const navigate = useNavigate();
  const fileRef      = useRef();
  const tempLogRef   = useRef();

  const [coords, setCoords]   = useState(null);
  const [batchInput, setBatchInput] = useState("");
  const [batch, setBatch]     = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const [deliveryFile, setDeliveryFile] = useState(null);
  const [tempLogFile, setTempLogFile]   = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState(null);
  const [success, setSuccess]           = useState(null);
  const [toast, setToast]               = useState(null);

  const [form, setForm] = useState({
    retailerName: "", deliveryQuantity: "", deliveryLocation: "",
    dispatchDate: "", expectedDeliveryDate: "", trackingNumber: "",
    coldChain: false, transferNotes: "",
  });

  const field = (key) => ({ value: form[key], onChange: e => setForm({ ...form, [key]: e.target.value }) });

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

  const requiredFilled = form.retailerName && form.deliveryQuantity &&
    form.deliveryLocation && form.dispatchDate && form.expectedDeliveryDate && deliveryFile;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!batch || !requiredFilled) { setError("Please complete all required fields and upload a delivery note."); return; }
    setSubmitting(true); setError(null);

    const transferData = JSON.stringify({
      retailerName: form.retailerName,
      deliveryQuantity: parseFloat(form.deliveryQuantity),
      deliveryLocation: form.deliveryLocation,
      dispatchDate: form.dispatchDate,
      expectedDeliveryDate: form.expectedDeliveryDate,
      trackingNumber: form.trackingNumber,
      coldChain: form.coldChain,
    });

    try {
      const res = await api.post("/batch/transfer", {
        batchId: batch.batchId,
        newOwner: form.retailerName, // TODO: replace with retailer wallet address after wallet association built
        senderRole: "distributor",
        transferData,
        latitude:  coords?.latitude  ?? 0,
        longitude: coords?.longitude ?? 0,
      });
      // Upload delivery note
      const fd = new FormData();
      fd.append("batchId", batch.batchId);
      fd.append("image", deliveryFile);
      await api.post("/batch/upload-image", fd);

      // Upload temp log if provided
      if (tempLogFile) {
        const fd2 = new FormData();
        fd2.append("batchId", batch.batchId);
        fd2.append("image", tempLogFile);
        await api.post("/batch/upload-image", fd2);
      }

      setSuccess({ batchId: batch.batchId, retailerName: form.retailerName, agreedLocation: res.data.agreedLocation });
      setToast({ message: "Custody transferred on-chain!", type: "success" });
    } catch (err) {
      setError(err.response?.data?.error || "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 740, margin: "0 auto" }}>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 4 }}>Transfer Custody</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>Record the final handoff of a batch to a retailer.</p>
      </div>

      {/* Info card */}
      <div style={{ padding: "14px 18px", borderRadius: 12, marginBottom: 16,
        background: "var(--fern-dim)", border: "1px solid var(--border-glow)",
        display: "flex", gap: 10, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        <Info size={16} color="var(--fern)" style={{ flexShrink: 0, marginTop: 2 }} />
        Record the final handoff of a processed batch to a retailer. This completes the verified supply chain —
        after this step, any consumer can scan the QR code and see the full journey from farm to retailer.
      </div>

      <GPSBar onCoordsChange={setCoords} />

      {success ? (
        <div className="glass-card fade-in" style={{ padding: "40px 36px", textAlign: "center" }}>
          <CheckCircle size={36} color="var(--fern)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", marginBottom: 12 }}>Custody Transferred</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
            <StatusPill status="TRANSFERRED" />
            <span style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>{success.retailerName}</span>
          </div>
          {success.agreedLocation && (
            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <MapPin size={14} color="var(--fern)" /> Recorded at: <strong>{success.agreedLocation}</strong>
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 24,
            padding: "12px 20px", borderRadius: 10, background: "var(--fern-dim)", border: "1px solid var(--border-glow)" }}>
            <CheckCircle size={14} color="var(--fern)" />
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              This batch is now fully traceable — the complete journey from farm to retailer is on-chain.
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn-primary" onClick={() => navigate(`/verify/${success.batchId}`)}>
              <ExternalLink size={14} /> View Full Journey
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
                <input className="field-input" placeholder="Batch ID"
                  value={batchInput} onChange={e => setBatchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lookupBatch(); } }}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }} />
              </div>
              <button className="btn-ghost" onClick={lookupBatch} disabled={lookingUp}>
                {lookingUp ? <Loader size={14} className="spin" /> : <Search size={14} />}
                Look Up
              </button>
            </div>
            {lookupError && <div className="error-generic"><Search size={14} style={{ flexShrink: 0 }} /><span>{lookupError}</span></div>}
            {batch && (
              <div style={{ padding: "14px 18px", borderRadius: 10, background: "var(--fern-dim)",
                border: "1px solid var(--border-glow)", display: "flex", flexWrap: "wrap", gap: 12 }} className="fade-in">
                <CheckCircle size={14} color="var(--fern)" style={{ marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{batch.herbType}</span>
                    <StatusPill status={batch.status} />
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {batch.processorData?.outputProductName && <span>{batch.processorData.outputProductName}</span>}
                    {batch.quantityKg && <span style={{ display: "flex", gap: 4 }}><Scale size={12} />{batch.quantityKg}kg</span>}
                    {batch.processorData?.storageConditions && <span>{batch.processorData.storageConditions}</span>}
                    {batch.processorData?.expiryDate && <span style={{ display: "flex", gap: 4 }}><Calendar size={12} />Expiry: {new Date(batch.processorData.expiryDate).toLocaleDateString("en-IN")}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Step 2: Transfer Details ── */}
          {batch && (
            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: "28px 28px" }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 20 }}>Step 2 — Transfer Details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                <div className="field-group">
                  <label className="field-label"><Store size={14} /> Retailer / Recipient Name *</label>
                  <input className="field-input" type="text" required placeholder="e.g. Nature's Basket Mumbai" {...field("retailerName")} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Scale size={14} /> Delivery Quantity (kg) *</label>
                    <input className="field-input" type="number" min="0.1" step="0.1" required placeholder="e.g. 50" {...field("deliveryQuantity")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><MapPin size={14} /> Delivery Location *</label>
                    <input className="field-input" type="text" required placeholder="e.g. Bandra West, Mumbai" {...field("deliveryLocation")} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="field-group">
                    <label className="field-label"><Calendar size={14} /> Dispatch Date *</label>
                    <input className="field-input" type="date" required {...field("dispatchDate")} />
                  </div>
                  <div className="field-group">
                    <label className="field-label"><Calendar size={14} /> Expected Delivery Date *</label>
                    <input className="field-input" type="date" required {...field("expectedDeliveryDate")} />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label"><Hash size={14} /> Vehicle / Shipment Tracking Number</label>
                  <input className="field-input" type="text" placeholder="e.g. MH12AB1234 or DTDC123456" {...field("trackingNumber")} />
                </div>

                {/* Cold chain toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)" }}>
                  <Thermometer size={16} color="var(--fern)" />
                  <span style={{ flex: 1, fontSize: "0.9rem" }}>Cold Chain Maintained</span>
                  <input type="checkbox" checked={form.coldChain}
                    onChange={e => setForm({ ...form, coldChain: e.target.checked })}
                    style={{ accentColor: "var(--fern)", width: 16, height: 16 }} />
                </label>

                {form.coldChain && (
                  <div className="field-group fade-in">
                    <label className="field-label"><FileText size={14} /> Temperature Log</label>
                    {tempLogFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fern)", fontSize: "0.88rem" }}>
                        <CheckCircle size={16} /> {tempLogFile.name}
                      </div>
                    ) : (
                      <div className="upload-zone" onClick={() => tempLogRef.current?.click()}
                        style={{ flexDirection: "column", display: "flex", alignItems: "center", padding: "20px" }}>
                        <Upload size={18} color="var(--fern)" />
                        <span style={{ fontSize: "0.82rem" }}>Upload temperature log (optional)</span>
                        <input ref={tempLogRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                          onChange={e => setTempLogFile(e.target.files[0])} />
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery note — REQUIRED */}
                <div className="field-group">
                  <label className="field-label"><FileText size={14} /> Delivery Note / Invoice *</label>
                  {deliveryFile ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fern)", fontSize: "0.88rem" }}>
                      <CheckCircle size={16} /> {deliveryFile.name}
                      <button type="button" onClick={() => setDeliveryFile(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>Change</button>
                    </div>
                  ) : (
                    <div className="upload-zone" onClick={() => fileRef.current?.click()}
                      style={{ flexDirection: "column", display: "flex", alignItems: "center" }}>
                      <Upload size={22} color="var(--fern)" />
                      <span style={{ fontSize: "0.85rem" }}>Upload delivery note or invoice — required</span>
                      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                        onChange={e => setDeliveryFile(e.target.files[0])} />
                    </div>
                  )}
                </div>

                <div className="field-group">
                  <label className="field-label"><AlignLeft size={14} /> Transfer Notes</label>
                  <textarea className="field-textarea" placeholder="Any additional notes about this transfer…" {...field("transferNotes")} />
                </div>

                <ErrorCard error={error} />

                <button type="submit" className="btn-primary" disabled={submitting || !requiredFilled}>
                  {submitting ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                  {submitting ? "Recording on-chain…" : "Transfer Custody"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
