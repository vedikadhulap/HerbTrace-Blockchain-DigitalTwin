import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Verify from "./pages/Verify";
import CreateBatch from "./pages/CreateBatch";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="nav-pill glass-panel">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Home
          </NavLink>
          <NavLink to="/verify" className={({ isActive }) => (isActive ? "active" : "")}>
            Verify Batch
          </NavLink>
          <NavLink to="/create-batch" className={({ isActive }) => (isActive ? "active" : "")}>
            Create Batch
          </NavLink>
        </nav>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/create-batch" element={<CreateBatch />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;