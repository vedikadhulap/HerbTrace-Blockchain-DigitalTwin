import { useState, useEffect } from "react";
import {
  ShieldCheck, Package, Clock, Users, CheckCircle, User, Mail,
  Building2, MapPin, Phone, Calendar, ExternalLink,
  UserMinus, XCircle, Search, Hash, Fingerprint, GitBranch,
  AlertTriangle, Loader,
} from "lucide-react";
import api from "../api";
import StatusPill from "../components/StatusPill";
import Toast from "../components/Toast";

const ROLE_COLORS = {
  farmer:      "var(--fern)",
  lab:         "#64B4FF",
  processor:   "#FFB464",
  distributor: "#B478FF",
  admin:       "#FF8080",
};

const STAGE_NAMES = ["CREATE", "TEST", "PROCESS", "TRANSFER"];
const CONFIDENCE_COLOR = { high: "var(--fern)", medium: "#FFB464", low: "var(--danger)" };

function UserCard({ user, onApprove, onReject, onRevoke, showPending, showApproved }) {
  return (
    <div className="glass-card" style={{
      padding: "18px 20px",
      borderLeft: `3px solid ${ROLE_COLORS[user.role] || "var(--border-glow)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <User size={16} color="var(--text-secondary)" />
            <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{user.name}</span>
            <span className={`status-pill status-${user.role}`} style={{
              background: `${ROLE_COLORS[user.role]}20`, borderColor: `${ROLE_COLORS[user.role]}50`,
              color: ROLE_COLORS[user.role],
            }}>
              {user.role}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            <span style={{ display: "flex", gap: 6 }}><Mail size={13} />{user.email}</span>
            {user.organizationName && <span style={{ display: "flex", gap: 6 }}><Building2 size={13} />{user.organizationName}</span>}
            {user.state && <span style={{ display: "flex", gap: 6 }}><MapPin size={13} />{user.state}</span>}
            {user.phone && <span style={{ display: "flex", gap: 6 }}><Phone size={13} />{user.phone}</span>}
            <span style={{ display: "flex", gap: 6 }}><Calendar size={13} />{new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {user.proofDocumentUrl && (
            <a href={user.proofDocumentUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
              <ExternalLink size={13} /> View Proof
            </a>
          )}
          {showPending && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary btn-sm" onClick={() => onApprove(user._id)}>
                <CheckCircle size={13} /> Approve
              </button>
              <button className="btn-danger btn-sm" onClick={() => onReject(user._id)}>
                <XCircle size={13} /> Reject
              </button>
            </div>
          )}
          {showApproved && (
            <button className="btn-danger btn-sm" onClick={() => onRevoke(user._id)}>
              <UserMinus size={13} /> Revoke Access
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Batch Integrity Tab ──────────────────────────────────────────────────────

function BatchIntegrity() {
  const [batchId, setBatchId]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [merkleData, setMerkleData]     = useState(null);
  const [locationData, setLocationData] = useState([]);
  const [error, setError]               = useState(null);

  const handleCheck = async () => {
    const id = batchId.trim();
    if (!id) return;
    setLoading(true); setError(null); setMerkleData(null); setLocationData([]);

    try {
      const merklePromises = [0, 1, 2, 3].map((idx) =>
        api.get(`/batch/${id}/merkle-proof/${idx}`).catch((e) => ({
          data: { stageIndex: idx, stageName: STAGE_NAMES[idx], notFound: true, error: e.response?.data?.error },
        }))
      );
      const [merkleResults, locRes] = await Promise.all([
        Promise.all(merklePromises),
        api.get(`/batch/${id}/location-verification`).catch(() => ({ data: [] })),
      ]);

      setMerkleData(merkleResults.map((r) => r.data));
      setLocationData(Array.isArray(locRes.data) ? locRes.data : []);
    } catch (err) {
      setError(err.response?.data?.error || "Check failed. Is the batch ID correct?");
    } finally {
      setLoading(false);
    }
  };

  const stageColors = ["var(--fern)", "#64B4FF", "#FFB464", "#B478FF"];
  const stageColorMap = { CREATE: "var(--fern)", TEST: "#64B4FF", PROCESS: "#FFB464", TRANSFER: "#B478FF" };

  return (
    <div>
      {/* Search */}
      <div className="glass-card" style={{ padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 4 }}>Batch Integrity Check</h3>
        <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 14 }}>
          Enter a batch ID to inspect its Merkle proof (tamper evidence) and multi-oracle GPS location records.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field-input-wrapper" style={{ flex: 1 }}>
            <Hash size={15} className="input-icon" />
            <input className="field-input"
              placeholder="e.g. ASHWAGANDHA-1786908, PROCESSED-1786…"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}
            />
          </div>
          <button className="btn-primary" onClick={handleCheck} disabled={loading || !batchId.trim()}>
            {loading ? <Loader size={14} className="spin" /> : <Search size={14} />}
            {loading ? "Checking…" : "Check Proof"}
          </button>
        </div>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "var(--danger)", fontSize: "0.82rem" }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}
      </div>

      {merkleData && (
        <div className="fade-in">
          {/* Merkle Table */}
          <div className="glass-card" style={{ padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <GitBranch size={18} color="var(--fern)" />
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>Merkle Anchoring — 4 Stage Leaves</h3>
            </div>

            {/* Merkle root summary */}
            {merkleData[0]?.merkleRoot && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                background: merkleData[0].anchored ? "rgba(100,200,100,0.08)" : "rgba(255,200,50,0.06)",
                border: `1px solid ${merkleData[0].anchored ? "var(--fern)" : "rgba(255,200,50,0.3)"}`,
                display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
              }}>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Merkle Root</span>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", flex: 1, wordBreak: "break-all" }}>
                  {merkleData[0].merkleRoot}
                </code>
                {merkleData[0].anchored ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--fern)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    <CheckCircle size={13} /> Anchored on-chain
                    {merkleData[0].anchoredTxHash && (
                      <a href={`https://sepolia.etherscan.io/tx/${merkleData[0].anchoredTxHash}`}
                        target="_blank" rel="noreferrer"
                        style={{ color: "#64B4FF", display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6, fontSize: "0.78rem" }}>
                        <ExternalLink size={11} /> Etherscan
                      </a>
                    )}
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#FFB464", fontSize: "0.8rem" }}>
                    <Clock size={13} /> Not yet anchored (needs all 4 stages)
                  </span>
                )}
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Stage", "Leaf Hash", "Proof Depth", "Status"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", fontSize: "0.7rem" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {merkleData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600,
                          background: `${stageColors[i]}18`, color: stageColors[i], border: `1px solid ${stageColors[i]}40`,
                        }}>
                          {row.stageName || STAGE_NAMES[i]}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                        {row.notFound
                          ? <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No data yet</span>
                          : row.leaf ? <span title={row.leaf}>{row.leaf.slice(0, 22)}…</span> : "—"}
                      </td>
                      <td style={{ padding: "10px 10px", color: "var(--text-secondary)" }}>
                        {row.proof?.length != null ? `${row.proof.length} node${row.proof.length !== 1 ? "s" : ""}` : "—"}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        {row.notFound
                          ? <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>Pending</span>
                          : <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--fern)", fontSize: "0.72rem" }}><CheckCircle size={11} /> Recorded</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Location Oracle Table */}
          {locationData.length === 0 ? (
            <div className="glass-card" style={{ padding: "20px 24px", textAlign: "center", color: "var(--text-muted)" }}>
              <MapPin size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ fontSize: "0.85rem" }}>No oracle location data recorded for this batch yet.</p>
              <p style={{ fontSize: "0.78rem" }}>Location data is captured when ENABLE_MULTI_ORACLE=true and GPS is provided.</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <MapPin size={18} color="var(--fern)" />
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>Multi-Oracle Location Verification</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {locationData.map((loc, i) => {
                  const confColor = CONFIDENCE_COLOR[loc.confidence] || "var(--text-muted)";
                  const sc = stageColorMap[loc.stage] || "var(--fern)";
                  const agreed = loc.successCount || loc.oracleResults?.filter((o) => o.success).length || 0;

                  return (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600, background: `${sc}18`, color: sc, border: `1px solid ${sc}40` }}>
                          {loc.stage}
                        </span>
                        {loc.agreedLocation ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: "0.88rem" }}>
                            <MapPin size={13} color="var(--fern)" /> {loc.agreedLocation}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", fontStyle: "italic" }}>Location not agreed</span>
                        )}
                        <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 600, background: `${confColor}18`, color: confColor, border: `1px solid ${confColor}40` }}>
                          {loc.confidence || loc.consensus || "unknown"} confidence
                        </span>
                      </div>

                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", flexWrap: "wrap", gap: 14 }}>
                        <span>{agreed}/3 oracles agreed</span>
                        {loc.oracleResults?.map((o, j) => (
                          <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 3, color: o.success ? "var(--fern)" : "var(--text-muted)" }}>
                            {o.success ? <CheckCircle size={11} /> : <XCircle size={11} />}
                            {o.source}{o.agreedLocation ? ` (${o.agreedLocation})` : ""}
                          </span>
                        ))}
                      </div>

                      {loc.durationMs && (
                        <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Oracle response: {loc.durationMs}ms
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!merkleData && !loading && (
        <div className="glass-card" style={{ padding: "48px 28px", textAlign: "center" }}>
          <Fingerprint size={48} color="var(--border-glow)" style={{ marginBottom: 14 }} />
          <p style={{ color: "var(--text-muted)" }}>Enter a batch ID above to inspect its cryptographic proof and location trail.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Component ─────────────────────────────────────────────────────

export default function Admin() {
  const [tab, setTab]             = useState("pending");
  const [pendingUsers, setPending] = useState([]);
  const [approvedUsers, setApproved] = useState([]);
  const [rejectedUsers, setRejected] = useState([]);
  const [batchCount, setBatchCount] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter]   = useState("all");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pendRes, appRes, rejRes, cntRes] = await Promise.all([
        api.get("/auth/pending"),
        api.get("/auth/users?status=approved"),
        api.get("/auth/users?status=rejected"),
        api.get("/batch/count"),
      ]);
      setPending(pendRes.data);
      setApproved(appRes.data);
      setRejected(rejRes.data);
      setBatchCount(cntRes.data.count);
    } catch (err) {
      console.error("Admin fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await api.patch(`/auth/approve/${userId}`, { decision: "approved" });
      const user = pendingUsers.find(u => u._id === userId);
      setPending(prev => prev.filter(u => u._id !== userId));
      if (user) setApproved(prev => [{ ...user, status: "approved" }, ...prev]);
      setToast({ message: "User approved", type: "success" });
    } catch { setToast({ message: "Approve failed", type: "error" }); }
  };

  const handleReject = async (userId) => {
    try {
      await api.patch(`/auth/approve/${userId}`, { decision: "rejected" });
      const user = pendingUsers.find(u => u._id === userId);
      setPending(prev => prev.filter(u => u._id !== userId));
      if (user) setRejected(prev => [{ ...user, status: "rejected" }, ...prev]);
      setToast({ message: "User rejected", type: "error" });
    } catch { setToast({ message: "Reject failed", type: "error" }); }
  };

  const handleRevoke = async (userId) => {
    try {
      await api.patch(`/auth/revoke/${userId}`);
      const user = approvedUsers.find(u => u._id === userId);
      setApproved(prev => prev.filter(u => u._id !== userId));
      if (user) setRejected(prev => [{ ...user, status: "rejected" }, ...prev]);
      setToast({ message: "Access revoked", type: "error" });
    } catch { setToast({ message: "Revoke failed", type: "error" }); }
  };

  const filterUsers = (list) => list.filter(u => {
    const matchSearch = !searchQuery ||
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const tabUsers = tab === "pending" ? filterUsers(pendingUsers) : tab === "approved" ? filterUsers(approvedUsers) : filterUsers(rejectedUsers);
  const isUserTab = ["pending", "approved", "rejected"].includes(tab);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <ShieldCheck size={24} color="var(--fern)" />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem" }}>Admin Dashboard</h1>
        {pendingUsers.length > 0 && (
          <div style={{
            background: "var(--danger)", color: "#fff", borderRadius: "50%",
            width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.72rem", fontWeight: 700,
          }}>{pendingUsers.length}</div>
        )}
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { icon: Package,     label: "Total Batches",    value: batchCount ?? "…" },
          { icon: Clock,       label: "Pending Requests", value: pendingUsers.length },
          { icon: Users,       label: "Approved Users",   value: approvedUsers.length },
          { icon: CheckCircle, label: "Total Users",      value: approvedUsers.length + pendingUsers.length + rejectedUsers.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon size={18} color="var(--fern)" />
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 600 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search + Role Filter — only shown on user tabs */}
      {isUserTab && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div className="field-input-wrapper" style={{ flex: 1 }}>
            <Search size={15} className="input-icon" />
            <input className="field-input" placeholder="Search by name or email…"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <select className="field-select" style={{ width: 160 }}
            value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="farmer">Farmer</option>
            <option value="lab">Lab</option>
            <option value="processor">Processor</option>
            <option value="distributor">Distributor</option>
          </select>
        </div>
      )}

      {/* Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[
          { key: "pending",   label: "Pending",         count: pendingUsers.length },
          { key: "approved",  label: "Approved",        count: approvedUsers.length },
          { key: "rejected",  label: "Rejected",        count: rejectedUsers.length },
          { key: "integrity", label: "Batch Integrity", count: 0 },
        ].map(({ key, label, count }) => (
          <button key={key} className={`tab-btn${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label}
            {count > 0 && (
              <span style={{ background: tab === key ? "var(--fern)" : "var(--border-glow)", color: "var(--text-primary)",
                borderRadius: 999, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 600 }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "integrity" ? (
        <BatchIntegrity />
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : tabUsers.length === 0 ? (
        <div className="glass-card" style={{ padding: "48px 28px", textAlign: "center" }}>
          {tab === "pending"
            ? <><CheckCircle size={48} color="var(--fern)" style={{ marginBottom: 14 }} /><p style={{ color: "var(--text-muted)" }}>All caught up — no pending requests.</p></>
            : <><Users size={48} color="var(--border-glow)" style={{ marginBottom: 14 }} /><p style={{ color: "var(--text-muted)" }}>No {tab} users{searchQuery ? " matching your search" : ""}.</p></>
          }
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tabUsers.map(user => (
            <UserCard
              key={user._id}
              user={user}
              onApprove={handleApprove}
              onReject={handleReject}
              onRevoke={handleRevoke}
              showPending={tab === "pending"}
              showApproved={tab === "approved"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
