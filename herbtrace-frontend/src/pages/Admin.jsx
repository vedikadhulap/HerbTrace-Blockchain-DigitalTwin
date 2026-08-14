import { useState, useEffect } from "react";
import api from "../api";

const ROLE_COLORS = {
  farmer:      "farmer",
  lab:         "lab",
  processor:   "processor",
  distributor: "distributor",
  admin:       "admin",
};

function Admin() {
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [actionState, setActionState] = useState({}); // { userId: "approving"|"rejecting"|"approved"|"rejected" }

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/auth/pending");
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load pending users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleDecision = async (userId, decision) => {
    const actionKey = decision === "approved" ? "approving" : "rejecting";
    setActionState(prev => ({ ...prev, [userId]: actionKey }));

    try {
      await api.patch(`/auth/approve/${userId}`, { decision });
      // Show inline confirmation for 1.5s before removing the card
      setActionState(prev => ({ ...prev, [userId]: decision }));
      setTimeout(() => {
        setUsers(prev => prev.filter(u => u._id !== userId));
        setActionState(prev => { const next = { ...prev }; delete next[userId]; return next; });
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${decision} user.`);
      setActionState(prev => { const next = { ...prev }; delete next[userId]; return next; });
    }
  };

  return (
    <div>
      <div className="glass-panel" style={{ padding: "40px" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Pending Role Requests</h1>
        <p style={{ color: "var(--paper-dim)", marginTop: 8 }}>
          Review new account applications. Click the proof document link to verify before approving.
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && (
          <div className="glass-panel" style={{ padding: "32px", textAlign: "center", color: "var(--paper-dim)" }}>
            Loading…
          </div>
        )}

        {error && !loading && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <p style={{ color: "#E8A87C", margin: 0 }}>{error}</p>
            <button onClick={fetchPending} className="btn-primary" style={{ marginTop: 14, fontSize: "0.88rem", padding: "10px 20px" }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", marginBottom: 14 }}>✅</div>
            <p style={{ color: "var(--paper-dim)", fontSize: "0.95rem" }}>No pending requests — all caught up.</p>
          </div>
        )}

        {users.map(user => {
          const state = actionState[user._id];
          const isActing = state === "approving" || state === "rejecting";
          const isDone   = state === "approved"  || state === "rejected";

          return (
            <div key={user._id} className="glass-panel" style={{
              padding: "28px 32px",
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 24,
              flexWrap: "wrap",
              opacity: isDone ? 0.6 : 1,
              transition: "opacity 0.4s",
            }}>
              {/* User info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>{user.name}</div>
                <div style={{ color: "var(--paper-dim)", fontSize: "0.85rem", marginTop: 4 }}>{user.email}</div>
                <div style={{ marginTop: 8 }}>
                  <span className={`role-badge ${ROLE_COLORS[user.role] || ""}`}>
                    {user.role}
                  </span>
                </div>
                <div style={{ marginTop: 10, fontSize: "0.8rem", color: "var(--paper-dim)" }}>
                  Submitted: {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                {user.proofDocumentUrl && (
                  <a href={user.proofDocumentUrl} target="_blank" rel="noreferrer"
                    style={{ display: "inline-block", marginTop: 10, color: "var(--fern-glow)", fontSize: "0.85rem", textDecoration: "underline" }}>
                    View proof document ↗
                  </a>
                )}
              </div>

              {/* Action buttons / confirmation */}
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                {isDone ? (
                  <span style={{
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    color: state === "approved" ? "var(--fern-glow)" : "#E8A87C",
                  }}>
                    {state === "approved" ? "Approved ✓" : "Rejected ✗"}
                  </span>
                ) : (
                  <>
                    <button
                      id={`approve-${user._id}`}
                      onClick={() => handleDecision(user._id, "approved")}
                      disabled={isActing}
                      className="btn-primary"
                      style={{ fontSize: "0.85rem", padding: "9px 20px", opacity: isActing ? 0.5 : 1 }}
                    >
                      {state === "approving" ? "Approving…" : "Approve"}
                    </button>
                    <button
                      id={`reject-${user._id}`}
                      onClick={() => handleDecision(user._id, "rejected")}
                      disabled={isActing}
                      style={{
                        padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(232,168,124,0.4)",
                        background: "rgba(232,168,124,0.08)", color: "#E8A87C",
                        fontSize: "0.85rem", fontWeight: 500, cursor: isActing ? "not-allowed" : "pointer",
                        opacity: isActing ? 0.5 : 1,
                      }}
                    >
                      {state === "rejecting" ? "Rejecting…" : "Reject"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Admin;
