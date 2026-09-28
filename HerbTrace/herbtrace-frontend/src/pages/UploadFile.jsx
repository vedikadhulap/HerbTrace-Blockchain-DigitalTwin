import { useState } from "react";
import api from "../api";

function UploadFile() {
  const [batchId, setBatchId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!batchId.trim() || !file) {
      setError("Both a batch ID and a file are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("batchId", batchId.trim());
    formData.append("file", file);

    try {
      const res = await api.post("/batch/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setBatchId("");
      setFile(null);
      // Reset the file input visually
      document.getElementById("upload-file-input").value = "";
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed. Check the batch ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: "1px solid var(--glass-border)", background: "rgba(255,255,255,0.03)",
    color: "var(--paper)", fontFamily: "var(--font-body)", fontSize: "0.95rem", boxSizing: "border-box",
  };
  const labelStyle = { display: "block", fontSize: "0.85rem", color: "var(--paper-dim)", marginBottom: 6 };

  return (
    <div>
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Upload File</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Attach a document or image to an existing batch (stored on IPFS via Pinata).
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Batch ID</label>
            <input
              id="upload-batchid"
              type="text" value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="e.g. ASHWAGANDHA-1723456789"
              required style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
            />
          </div>

          <div>
            <label style={labelStyle}>File (image or PDF)</label>
            <input
              id="upload-file-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files[0])}
              required
              style={{ ...inputStyle, padding: "10px 16px", cursor: "pointer" }}
            />
            {file && (
              <p style={{ fontSize: "0.8rem", color: "var(--paper-dim)", marginTop: 6 }}>
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <button
            id="upload-submit"
            type="submit" disabled={loading}
            style={{
              padding: "14px 24px", borderRadius: 12, border: "none",
              background: "var(--moss)", color: "var(--paper)", fontWeight: 500,
              fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8, opacity: loading ? 0.6 : 1, transition: "opacity 0.2s",
            }}
          >
            {loading ? "Uploading to IPFS…" : "Upload File"}
          </button>
        </form>

        {error && <p style={{ color: "#E8A87C", marginTop: 16 }}>{error}</p>}
      </div>

      {result && (
        <div className="glass-panel" style={{ padding: "32px", marginTop: 24 }}>
          <span className="status-pill" style={{ background: "rgba(61,107,79,0.3)" }}>Uploaded</span>
          <h2 style={{ fontSize: "1.2rem", marginTop: 12 }}>File attached to {result.batchId}</h2>
          <div style={{ marginTop: 12 }}>
            {result.images?.slice(-1).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--fern-glow)", fontSize: "0.88rem", wordBreak: "break-all" }}
              >
                View on IPFS ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadFile;
