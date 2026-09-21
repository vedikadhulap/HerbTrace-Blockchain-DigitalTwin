import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { Clock, ArrowLeft } from "lucide-react";

export default function PendingApproval() {
  const location = useLocation();
  // role is passed via React Router state when coming from signup
  const role = location.state?.role || localStorage.getItem("role") || "your role";

  return (
    <div style={{ maxWidth: 480, margin: "60px auto" }}>
      <div className="glass-card" style={{ padding: "48px 40px", textAlign: "center" }}>
        <Clock size={48} color="var(--fern)" style={{ marginBottom: 24 }} />

        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 12 }}>
          Application Submitted
        </h1>

        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 28, fontSize: "0.95rem" }}>
          Your request for <strong style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>{role}</strong> access
          has been received. An admin will review your proof document and approve or reject your application.
          You'll be able to log in once approved.
        </p>

        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6,
          color: "var(--fern)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500 }}>
          <ArrowLeft size={14} /> Back to Home
        </Link>
      </div>
    </div>
  );
}
