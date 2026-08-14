import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";

const ROLE_HOME = {
  farmer: "/create-batch",
  lab: "/lab-test",
  processor: "/process-batch",
  distributor: "/transfer",
  admin: "/admin",
};

function Login() {
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/auth/login", form);
      const { token, role, name } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("role",  role);
      localStorage.setItem("name",  name || "");

      navigate(ROLE_HOME[role] || "/");
    } catch (err) {
      const data   = err.response?.data;
      const status = data?.status; // "pending" | "rejected" — set by authController

      if (status === "pending") {
        setError("Your account is pending admin review. You'll receive access once approved.");
      } else if (status === "rejected") {
        setError("Your application was not approved. Contact support for more information.");
      } else if (err.response?.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError(data?.error || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div className="glass-panel" style={{ padding: "48px 40px" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 8 }}>Sign in</h1>
        <p style={{ color: "var(--paper-dim)", fontSize: "0.9rem", marginBottom: 36 }}>
          Access your HerbTrace dashboard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label className="field-label">Email</label>
            <input
              id="login-email"
              type="email" name="email" autoComplete="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Password</label>
            <input
              id="login-password"
              type="password" name="password" autoComplete="current-password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              className="field-input"
            />
          </div>

          {error && (
            <div style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "rgba(232,168,124,0.1)",
              border: "1px solid rgba(232,168,124,0.3)",
              color: "#E8A87C",
              fontSize: "0.88rem",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: "100%", marginTop: 4, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 28, fontSize: "0.88rem", color: "var(--paper-dim)", textAlign: "center" }}>
          Don't have an account?{" "}
          <Link to="/signup" style={{ color: "var(--fern-glow)", textDecoration: "underline" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
