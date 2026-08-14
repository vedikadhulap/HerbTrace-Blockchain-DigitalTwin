import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PendingApproval from "./pages/PendingApproval";
import Verify from "./pages/Verify";
import CreateBatch from "./pages/CreateBatch";
import LabTest from "./pages/LabTest";
import ProcessBatch from "./pages/ProcessBatch";
import TransferCustody from "./pages/TransferCustody";
import Admin from "./pages/Admin";

import "./App.css";

// Where each role's home page is
const ROLE_HOME = {
  farmer: "/create-batch",
  lab: "/lab-test",
  processor: "/process-batch",
  distributor: "/transfer",
  admin: "/admin",
};

// Nav links per role
const NAV_LINKS = {
  farmer:      [{ to: "/create-batch", label: "Create Batch" }, { to: "/verify", label: "Verify Batch" }],
  lab:         [{ to: "/lab-test",     label: "Lab Test"     }, { to: "/verify", label: "Verify Batch" }],
  processor:   [{ to: "/process-batch",label: "Process Batch"}, { to: "/verify", label: "Verify Batch" }],
  distributor: [{ to: "/transfer",     label: "Transfer"     }, { to: "/verify", label: "Verify Batch" }],
  admin:       [{ to: "/admin",        label: "Admin Dashboard"}],
};

// ProtectedRoute — redirects to /login if no token, or to role home if wrong role
function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={ROLE_HOME[role] || "/"} replace />;
  }
  return children;
}

function Nav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const token     = localStorage.getItem("token");
  const role      = localStorage.getItem("role");
  const name      = localStorage.getItem("name");
  const isHome    = location.pathname === "/";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    localStorage.removeItem("wallet");
    navigate("/login");
  };

  const links = token && role ? NAV_LINKS[role] || [] : [];

  return (
    <nav className="nav-pill glass-panel">
      {/* Brand */}
      <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
        🌿 HerbTrace
      </NavLink>

      {/* Role-specific links */}
      {links.map(link => (
        <NavLink key={link.to} to={link.to} className={({ isActive }) => isActive ? "active" : ""}>
          {link.label}
        </NavLink>
      ))}

      {/* Public verify for unauthenticated visitors */}
      {!token && (
        <NavLink to="/verify" className={({ isActive }) => isActive ? "active" : ""}>
          Verify Batch
        </NavLink>
      )}

      {/* Spacer + auth actions pushed right */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {token ? (
          <>
            <span style={{ fontSize: "0.78rem", color: "var(--paper-dim)", textTransform: "capitalize", paddingRight: 4 }}>
              {name || role}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "7px 14px", borderRadius: 10, border: "1px solid var(--glass-border)",
                background: "transparent", color: "var(--paper-dim)", fontSize: "0.82rem",
                cursor: "pointer", transition: "color 0.2s",
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className={({ isActive }) => isActive ? "active" : ""}>Sign in</NavLink>
            <NavLink
              to="/signup"
              className={({ isActive }) => isActive ? "active" : ""}
              style={{ background: "var(--moss)", padding: "9px 16px", borderRadius: 12 }}
            >
              Sign up
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}

function App() {
  const isHome = typeof window !== "undefined" && window.location.pathname === "/";

  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

function AppInner() {
  const location = useLocation();
  const isHome   = location.pathname === "/";

  return (
    <div className="app-shell">
      <Nav />
      <div className={`page-content ${isHome ? "full-width" : ""}`}>
        <Routes>
          <Route path="/"        element={<Home />} />
          <Route path="/login"   element={<Login />} />
          <Route path="/signup"  element={<Signup />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/verify"           element={<Verify />} />
          <Route path="/verify/:batchId"  element={<Verify />} />

          <Route path="/create-batch" element={
            <ProtectedRoute requiredRole="farmer"><CreateBatch /></ProtectedRoute>
          } />
          <Route path="/lab-test" element={
            <ProtectedRoute requiredRole="lab"><LabTest /></ProtectedRoute>
          } />
          <Route path="/process-batch" element={
            <ProtectedRoute requiredRole="processor"><ProcessBatch /></ProtectedRoute>
          } />
          <Route path="/transfer" element={
            <ProtectedRoute requiredRole="distributor"><TransferCustody /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin"><Admin /></ProtectedRoute>
          } />
        </Routes>
      </div>
    </div>
  );
}

export default App;