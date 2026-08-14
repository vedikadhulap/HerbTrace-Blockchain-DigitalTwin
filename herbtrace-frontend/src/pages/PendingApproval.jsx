import { Link } from "react-router-dom";

function PendingApproval() {
  const role = localStorage.getItem("role") || "your role";

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="glass-panel" style={{ padding: "56px 48px", textAlign: "center" }}>
        <div style={{ fontSize: "3.2rem", marginBottom: 24 }}>🕐</div>
        <h1 style={{ fontSize: "1.6rem", marginBottom: 14 }}>Application Submitted</h1>
        <p style={{ color: "var(--paper-dim)", lineHeight: 1.75, fontSize: "0.95rem", maxWidth: 380, margin: "0 auto" }}>
          Your request for{" "}
          <strong style={{ color: "var(--fern-glow)", textTransform: "capitalize" }}>{role}</strong>{" "}
          access has been received. An admin will review your proof document and approve or reject your application.
          You'll be able to log in once approved.
        </p>
        <p style={{ color: "var(--paper-dim)", fontSize: "0.84rem", marginTop: 16 }}>
          This usually takes 1–2 business days.
        </p>
        <Link to="/" className="btn-primary" style={{ display: "inline-block", marginTop: 36, textDecoration: "none" }}>
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default PendingApproval;
