import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

// Temporary — will be removed once login exists and the wallet comes from the logged-in farmer instead
const FARMER_WALLET = "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8";

function CreateBatch() {
  const [form, setForm] = useState({
    herbType: "",
    farmLocation: "",
    harvestDate: "",
    quantityKg: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

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
    });
    setCreated(res.data.batch || res.data);
    setForm({ herbType: "", farmLocation: "", harvestDate: "", quantityKg: "" });
  } catch (err) {
    console.error(err.response?.data);
    setError("Something went wrong creating the batch. Check the details and try again.");
  } finally {
    setLoading(false);
  }
};

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--glass-border)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--paper)",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.85rem",
    color: "var(--paper-dim)",
    marginBottom: 6,
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Create Batch</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Record a new harvest on-chain.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Herb type</label>
            <input
              type="text"
              name="herbType"
              value={form.herbType}
              onChange={handleChange}
              placeholder="e.g. Ashwagandha"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Farm location</label>
            <input
              type="text"
              name="farmLocation"
              value={form.farmLocation}
              onChange={handleChange}
              placeholder="e.g. Nashik, Maharashtra"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Harvest date</label>
            <input
              type="date"
              name="harvestDate"
              value={form.harvestDate}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Quantity (kg)</label>
            <input
              type="number"
              name="quantityKg"
              value={form.quantityKg}
              onChange={handleChange}
              placeholder="e.g. 50"
              required
              min="0"
              step="0.1"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 24px",
              borderRadius: 12,
              border: "none",
              background: "var(--moss)",
              color: "var(--paper)",
              fontWeight: 500,
              fontSize: "0.95rem",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            {loading ? "Writing to chain..." : "Create Batch"}
          </button>
        </form>

        {error && <p style={{ color: "#E8A87C", marginTop: 16 }}>{error}</p>}
      </div>

      {created && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 24 }}>
          <span className="status-pill">Created</span>
          <h2 style={{ fontSize: "1.3rem", marginTop: 12 }}>{created.herbType}</h2>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--paper-dim)", marginTop: 6 }}>
            {created.batchId}
          </p>
          <Link
            to={`/verify/${created.batchId}`}
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "var(--fern-glow)",
              fontSize: "0.9rem",
              textDecoration: "underline",
            }}
          >
            View this batch on the Verify page →
          </Link>
        </div>
      )}
    </div>
  );
}

export default CreateBatch;