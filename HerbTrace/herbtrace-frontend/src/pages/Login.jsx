import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, Clock, XCircle } from "lucide-react";
import api from "../api";

const ROLE_DEST = {
  farmer:      "/create-batch",
  lab:         "/lab-test",
  processor:   "/process-batch",
  distributor: "/transfer",
  admin:       "/admin",
};

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [showPw, setShowPw]   = useState(false);
  const [rememberMe, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await api.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role",  res.data.role);
      localStorage.setItem("name",  res.data.name);
      if (rememberMe) localStorage.setItem("rememberMe", "true");
      navigate(ROLE_DEST[res.data.role] || "/");
    } catch (err) {
      const status = err.response?.status;
      const data   = err.response?.data || {};
      if (status === 401) {
        setError({ icon: "invalid", text: "Invalid email or password." });
      } else if (status === 403 && data.status === "pending") {
        setError({ icon: "pending", text: "Your account is pending admin review. You'll receive access once approved." });
      } else if (status === 403 && data.status === "rejected") {
        setError({ icon: "rejected", text: "Your application was not approved. Contact your administrator." });
      } else {
        setError({ icon: "invalid", text: data.error || "Login failed. Try again." });
      }
    } finally {
      setLoading(false);
    }
  };

  const errorIcons = {
    invalid:  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />,
    pending:  <Clock       size={16} style={{ flexShrink: 0, marginTop: 2 }} />,
    rejected: <XCircle     size={16} style={{ flexShrink: 0, marginTop: 2 }} />,
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="glass-card" style={{ padding: "40px 36px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 6 }}>Sign In</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 28 }}>
          Welcome back to HerbTrace.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field-group">
            <label className="field-label"><Mail size={13} /> Email</label>
            <div className="field-input-wrapper">
              <Mail size={15} className="input-icon" />
              <input className="field-input" type="email" required autoComplete="email"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com" />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label"><Lock size={13} /> Password</label>
            <div className="field-input-wrapper">
              <Lock size={15} className="input-icon" />
              <input className="field-input" type={showPw ? "text" : "password"} required
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" />
              <button type="button" className="input-icon-right" onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem",
            color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={rememberMe} onChange={e => setRemember(e.target.checked)}
              style={{ accentColor: "var(--fern)", width: 15, height: 15 }} />
            Remember me
          </label>

          {error && (
            <div className="error-generic">
              {errorIcons[error.icon]}
              <span>{error.text}</span>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            <LogIn size={16} /> {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "var(--fern)", textDecoration: "none", fontWeight: 500 }}>Sign up</Link>
        </p>
        <p style={{ marginTop: 8, textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Forgot password? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
