import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Mail, Phone, Building2, MapPin, Calendar, ExternalLink,
  CheckCircle, Clock, Package, Hash,
} from "lucide-react";
import api from "../api";
import StatusPill from "../components/StatusPill";

export default function Profile() {
  const navigate  = useNavigate();
  const [user, setUser]     = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [meRes, batchRes] = await Promise.all([
          api.get("/auth/me"),
          api.get("/auth/my-batches"),
        ]);
        setUser(meRes.data);
        setBatches(batchRes.data);
      } catch (err) {
        setError("Failed to load profile.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading profile…</div>
  );

  if (error) return (
    <div className="error-generic" style={{ maxWidth: 480, margin: "40px auto" }}>
      <User size={16} style={{ flexShrink: 0 }} />
      <span>{error}</span>
    </div>
  );

  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const ROLE_COLORS = { farmer: "var(--fern)", lab: "#64B4FF", processor: "#FFB464", distributor: "#B478FF", admin: "#FF8080" };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Profile Card */}
      <div className="glass-card" style={{ padding: "36px 32px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--fern-dim)", border: "2px solid var(--border-glow)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 600, color: "var(--fern)",
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", marginBottom: 6 }}>{user.name}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="status-pill" style={{
                background: `${ROLE_COLORS[user.role]}20`,
                borderColor: `${ROLE_COLORS[user.role]}50`,
                color: ROLE_COLORS[user.role],
              }}>
                {user.role}
              </span>
              {user.status === "approved"
                ? <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "var(--fern)" }}><CheckCircle size={13} /> Approved</span>
                : <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", color: "var(--warning)" }}><Clock size={13} /> Pending</span>
              }
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { icon: Mail,      label: "Email",            value: user.email },
            { icon: Phone,     label: "Phone",            value: user.phone || "—" },
            { icon: Building2, label: "Organization",     value: user.organizationName || "—" },
            { icon: MapPin,    label: "State / Region",   value: user.state || "—" },
            { icon: Calendar,  label: "Member since",     value: new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
              borderBottom: "1px solid var(--border)", fontSize: "0.9rem" }}>
              <Icon size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ color: "var(--text-muted)", minWidth: 130, fontSize: "0.82rem" }}>{label}</span>
              <span>{value}</span>
            </div>
          ))}
          {user.proofDocumentUrl && (
            <div style={{ paddingTop: 14 }}>
              <a href={user.proofDocumentUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                <ExternalLink size={13} /> View your proof document
              </a>
            </div>
          )}
        </div>
      </div>

      {/* My Batches */}
      <div className="glass-card" style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Package size={18} color="var(--fern)" />
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>My Batches</h2>
        </div>
        {batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>
            <Package size={36} color="var(--border-glow)" style={{ marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            No batches yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {batches.map(b => (
              <div key={b._id} className="glass-card" style={{
                padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer",
              }} onClick={() => navigate(`/verify/${b.batchId}`)}>
                <Hash size={12} color="var(--text-muted)" />
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", flex: 1, color: "var(--text-secondary)" }}>
                  {b.batchId}
                </code>
                <span style={{ fontSize: "0.85rem" }}>{b.herbType}</span>
                <StatusPill status={b.status} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {new Date(b.createdAt).toLocaleDateString("en-IN")}
                </span>
                <ExternalLink size={12} color="var(--text-muted)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
