import { useCallback } from "react";
import {
  BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation, Navigate,
} from "react-router-dom";
import {
  Leaf, Search, LogOut, Sun, Moon, ShieldCheck,
  Sprout, FlaskConical, Settings2, Truck, UserPlus, LogIn, User, Activity,
} from "lucide-react";

import { useTheme }       from "./hooks/useTheme";
import ProtectedRoute     from "./components/ProtectedRoute";

import Home              from "./pages/Home";
import Login             from "./pages/Login";
import Signup            from "./pages/Signup";
import PendingApproval   from "./pages/PendingApproval";
import Verify            from "./pages/Verify";
import CreateBatch       from "./pages/CreateBatch";
import LabTest           from "./pages/LabTest";
import ProcessBatch      from "./pages/ProcessBatch";
import TransferCustody   from "./pages/TransferCustody";
import Admin             from "./pages/Admin";
import Profile           from "./pages/Profile";
import DigitalTwin       from "./pages/DigitalTwin";

import "./index.css";
import "./App.css";

/* ── Nav ──────────────────────────────────────────────────────── */
function Nav() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const role = localStorage.getItem("role");
  const name = localStorage.getItem("name");

  const handleLogout = useCallback(() => {
    localStorage.clear();
    localStorage.setItem("theme", theme); // preserve theme across logout
    navigate("/login");
  }, [navigate, theme]);

  const navLink = (to, label, Icon, end = false) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
    >
      <Icon size={15} /> {label}
    </NavLink>
  );

  return (
    <nav className="nav-bar">
      <NavLink to="/" end className="nav-logo">
        <Leaf size={18} color="var(--fern)" />
        HerbTrace
      </NavLink>

      {navLink("/verify", "Verify", Search)}
      {navLink("/digital-twin", "Digital Twin", Activity)}

      {!role && navLink("/login",  "Sign In",  LogIn)}
      {!role && navLink("/signup", "Sign Up",  UserPlus)}

      {role === "farmer"      && navLink("/create-batch",  "Create Batch",    Sprout)}
      {role === "lab"         && navLink("/lab-test",      "Lab Test",        FlaskConical)}
      {role === "processor"   && navLink("/process-batch", "Process",         Settings2)}
      {role === "distributor" && navLink("/transfer",      "Transfer",        Truck)}
      {role === "admin"       && navLink("/admin",         "Admin",           ShieldCheck)}

      <div className="nav-spacer" />

      {/* Theme toggle */}
      <button className="nav-icon-btn" onClick={toggle} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* User profile + logout */}
      {role && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-icon-btn${isActive ? " active" : ""}`}
            title={name || role}
            style={{ textDecoration: "none" }}
          >
            <User size={15} />
          </NavLink>
          <button className="nav-icon-btn" onClick={handleLogout} title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      )}
    </nav>
  );
}

/* ── App Inner ────────────────────────────────────────────────── */
function AppInner() {
  const location = useLocation();
  const isHome   = location.pathname === "/";
  const isDT     = location.pathname === "/digital-twin";

  return (
    <div className="app-shell">
      <Nav />
      <div className={`page-content${isHome || isDT ? " full-width" : ""}`}>
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/signup"        element={<Signup />} />
          <Route path="/pending"       element={<PendingApproval />} />
          <Route path="/verify"        element={<Verify />} />
          <Route path="/verify/:batchId" element={<Verify />} />
          <Route path="/digital-twin"  element={<DigitalTwin />} />

          <Route path="/create-batch"  element={<ProtectedRoute requiredRole="farmer">      <CreateBatch />    </ProtectedRoute>} />
          <Route path="/lab-test"      element={<ProtectedRoute requiredRole="lab">         <LabTest />        </ProtectedRoute>} />
          <Route path="/process-batch" element={<ProtectedRoute requiredRole="processor">   <ProcessBatch />   </ProtectedRoute>} />
          <Route path="/transfer"      element={<ProtectedRoute requiredRole="distributor"> <TransferCustody /></ProtectedRoute>} />
          <Route path="/admin"         element={<ProtectedRoute requiredRole="admin">       <Admin />          </ProtectedRoute>} />
          <Route path="/profile"       element={<ProtectedRoute>                            <Profile />        </ProtectedRoute>} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

/* ── App Root ─────────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}