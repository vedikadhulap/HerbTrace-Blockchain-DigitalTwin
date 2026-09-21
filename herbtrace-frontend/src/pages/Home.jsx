import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, UserPlus, Link2, Database, MapPin, ShieldCheck, Lock,
  Sprout, FlaskConical, Settings2, Truck, ScanLine, ArrowRight,
  FileText, Code, Activity, Hash, QrCode, GitBranch, ExternalLink,
} from "lucide-react";
import api from "../api";
import StatusPill from "../components/StatusPill";

/* ── Small helpers ───────────────────────────────────────────── */
function TrustPill({ icon: Icon, label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "8px 16px", borderRadius: 999,
      border: "1px solid var(--border)", background: "var(--bg-card)",
      fontSize: "0.82rem", color: "var(--text-secondary)",
      backdropFilter: "blur(12px)",
    }}>
      <Icon size={14} color="var(--fern)" />
      {label}
    </div>
  );
}

function StatNum({ value, label }) {
  return (
    <div style={{ textAlign: "center", padding: "0 16px" }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: 400,
        background: "var(--gradient-text)", WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent", lineHeight: 1.1,
      }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6,
        letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function StatDivider() {
  return <div style={{ width: 1, height: 48, background: "var(--border)", flexShrink: 0 }} />;
}

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const STEP_FLOW = [
  { icon: Sprout,       num: "01", title: "Farmer",      desc: "Records harvest: herb type, GPS-verified farm location, quantity, farming method" },
  { icon: FlaskConical, num: "02", title: "Lab",         desc: "Tests and certifies: pesticide levels, heavy metals, moisture, active compound, uploads certificate" },
  { icon: Settings2,    num: "03", title: "Processor",   desc: "Combines raw batches into a finished product, linking all ingredient batches on-chain" },
  { icon: Truck,        num: "04", title: "Distributor", desc: "Records final custody transfer to retailer, completing the verified supply chain trail" },
];

const FEATURE_CARDS = [
  {
    icon: ShieldCheck, title: "Tamper-Proof Records",
    desc: "Every batch record is hashed using Ethereum's keccak256 algorithm and written on-chain. Editing a record after the fact changes the hash — the fraud becomes visible instantly.",
  },
  {
    icon: MapPin, title: "GPS-Verified Locations",
    desc: "Farm coordinates are captured by the device at submission time and verified against the typed location via OpenStreetMap reverse geocoding. If they don't match, the batch is rejected.",
  },
  {
    icon: QrCode, title: "Scan to Verify",
    desc: "Every batch gets a unique QR code. A consumer scans it with any phone camera — no app needed — and sees the full certified history from farm to shelf.",
  },
];

const ROLE_CARDS = [
  { icon: Sprout,       role: "farmer",      label: "Farmer",      desc: "Record your harvests with GPS-verified location, farming method, and quantity.", proof: "Kisan ID or land ownership papers" },
  { icon: FlaskConical, role: "lab",         label: "Lab",         desc: "Certify batches with structured test results and a mandatory uploaded certificate.", proof: "Lab accreditation certificate" },
  { icon: Settings2,    role: "processor",   label: "Processor",   desc: "Combine verified raw batches into finished products, linking all ingredients on-chain.", proof: "Business registration or GST certificate" },
  { icon: Truck,        role: "distributor", label: "Distributor", desc: "Record the final handoff to retailers, completing the verifiable supply chain.", proof: "Distribution license" },
];

export default function Home() {
  const navigate = useNavigate();
  const [verifyId, setVerifyId]         = useState("");
  const [batchCount, setBatchCount]     = useState(null);
  const [recentBatches, setRecentBatches] = useState([]);
  const intervalRef = useRef(null);

  const fetchStats = async () => {
    try {
      const [countRes, recentRes] = await Promise.all([
        api.get("/batch/count"),
        api.get("/batch/recent"),
      ]);
      setBatchCount(countRes.data.count);
      setRecentBatches(recentRes.data);
    } catch { /* silently ignore — stats are non-critical */ }
  };

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleVerify = (e) => {
    e.preventDefault();
    if (verifyId.trim()) navigate(`/verify/${verifyId.trim()}`);
  };

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", textAlign: "center", padding: "0 24px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(61,107,79,0.22) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(127,168,140,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }} className="fade-in-up">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 14px",
            borderRadius: 999, border: "1px solid var(--border-glow)", background: "var(--fern-dim)",
            fontSize: "0.78rem", color: "var(--fern)", marginBottom: 28, letterSpacing: "0.03em",
          }}>
            <Sprout size={13} /> Blockchain Supply Chain Platform
          </div>

          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "clamp(2.4rem, 6vw, 3.8rem)",
            fontWeight: 400, lineHeight: 1.15, color: "var(--text-primary)", marginBottom: 22,
          }}>
            From Soil to Shelf —<br />
            Every Step <span className="gradient-text">Verified</span>
          </h1>

          <p style={{ fontSize: "1.05rem", color: "var(--text-secondary)", lineHeight: 1.75, maxWidth: 520, margin: "0 auto 36px" }}>
            HerbTrace records every stage of your herbal product's journey on the Ethereum blockchain.
            Tamper-proof. GPS-verified. Scannable by anyone.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
            <button className="btn-primary" onClick={() => navigate("/verify")}>
              <Search size={16} /> Verify a Batch
            </button>
            <button className="btn-ghost" onClick={() => navigate("/signup")}>
              <UserPlus size={16} /> Join as a Partner
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            <ShieldCheck size={12} color="var(--fern)" />
            Deployed on Ethereum Sepolia · Open source · Zero data brokers
          </div>
        </div>
      </section>

      {/* ── Live Stats Bar ────────────────────────────────────── */}
      <section style={{ padding: "0 24px 60px" }}>
        <div className="glass-card" style={{
          maxWidth: 820, margin: "0 auto", padding: "36px 48px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 0,
        }}>
          <StatNum value={batchCount !== null ? `${batchCount}+` : "…"} label="Batches Tracked" />
          <StatDivider />
          <StatNum value="100%" label="On-Chain Records" />
          <StatDivider />
          <StatNum value="< 2s" label="Verification Time" />
          <StatDivider />
          <StatNum value="0"    label="Data Breaches" />
        </div>
      </section>

      {/* ── Trust Bar ────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 64px" }}>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <TrustPill icon={Link2}      label="Ethereum Sepolia" />
          <TrustPill icon={Database}   label="IPFS Storage" />
          <TrustPill icon={MapPin}     label="GPS-Verified" />
          <TrustPill icon={ShieldCheck}label="Role-Based Access" />
          <TrustPill icon={Lock}       label="Tamper-Proof Hashing" />
        </div>
      </section>

      <div className="section-divider" style={{ margin: "0 24px 64px" }} />

      {/* ── How It Works ──────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", textAlign: "center", marginBottom: 8 }}>
            The Chain of Custody, Made Transparent
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 48 }}>
            Every role in the supply chain leaves a verifiable, immutable record.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, position: "relative" }}>
            <div style={{
              position: "absolute", top: 40, left: "12.5%", right: "12.5%",
              height: 1, background: "linear-gradient(90deg, transparent, var(--border-glow), var(--fern), var(--border-glow), transparent)",
              zIndex: 0,
            }} />
            {STEP_FLOW.map((s, i) => (
              <div key={i} style={{ textAlign: "center", padding: "0 16px", position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 8 }}>{s.num}</div>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  border: "1px solid var(--border-glow)", background: "var(--bg-card)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", boxShadow: "0 0 24px var(--glow)", backdropFilter: "blur(12px)",
                }}>
                  <s.icon size={28} color="var(--fern)" />
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem", marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", marginTop: 40, color: "var(--text-secondary)", fontSize: "0.9rem",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <ScanLine size={14} color="var(--fern)" />
            A consumer scans the QR code on any phone and sees the full verified journey — no app, no account, no friction.
          </p>
        </div>
      </section>

      <div className="section-divider" style={{ margin: "0 24px 64px" }} />

      {/* ── Feature Cards ─────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {FEATURE_CARDS.map((f, i) => (
              <div key={i} className="glass-card" style={{ padding: "28px 24px", borderTop: "2px solid var(--fern)" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", background: "var(--fern-dim)",
                  border: "1px solid var(--border-glow)", display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: 16,
                }}>
                  <f.icon size={24} color="var(--fern)" />
                </div>
                <div style={{ fontWeight: 600, fontSize: "1rem", marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Role Cards ────────────────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", textAlign: "center", marginBottom: 8 }}>
            Join the Supply Chain
          </h2>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 40, fontSize: "0.95rem" }}>
            Each role has verified access to its stage of the process.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {ROLE_CARDS.map((r) => (
              <div key={r.role} className="glass-card" style={{ padding: "24px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", background: "var(--fern-dim)",
                    border: "1px solid var(--border-glow)", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <r.icon size={18} color="var(--fern)" />
                  </div>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1rem" }}>{r.label}</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>{r.desc}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <FileText size={12} /> Requires: {r.proof}
                </div>
                <button className="btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/signup")}>
                  <UserPlus size={14} /> Sign Up as {r.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent Activity Feed ──────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div className="glass-card" style={{ padding: "28px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Activity size={18} color="var(--fern)" />
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>Recent Activity</h3>
            </div>
            {recentBatches.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", textAlign: "center", padding: "20px 0" }}>
                No activity yet — be the first to create a batch.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recentBatches.map((b) => (
                  <div key={b._id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border)",
                  }}>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)", flex: 1 }}>
                      {b.batchId}
                    </code>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>{b.herbType}</span>
                    <StatusPill status={b.status} />
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                      {relativeTime(b.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Consumer Verify CTA ──────────────────────────────── */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div className="glass-card" style={{ padding: "48px 40px", textAlign: "center" }}>
            <ScanLine size={36} color="var(--fern)" style={{ marginBottom: 20 }} />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", marginBottom: 12 }}>
              Have a product in hand?
            </h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 28, fontSize: "0.92rem" }}>
              Enter the batch ID printed on the label or scan the QR code.
            </p>
            <form onSubmit={handleVerify} style={{ display: "flex", gap: 10 }}>
              <div className="field-input-wrapper" style={{ flex: 1 }}>
                <Hash size={15} className="input-icon" />
                <input
                  className="field-input"
                  placeholder="Batch ID — e.g. ASHWAGANDHA-1786892130"
                  value={verifyId}
                  onChange={e => setVerifyId(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={!verifyId.trim()}>
                <ArrowRight size={16} /> Verify Now
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid var(--border)", padding: "32px 40px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16, color: "var(--text-muted)",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <Sprout size={14} color="var(--fern)" />
            <span style={{ fontFamily: "var(--font-display)", color: "var(--text-secondary)" }}>HerbTrace</span>
          </div>
          <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
            Blockchain-powered herbal traceability.
          </span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: "0.82rem" }}>
          <a href="/verify" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Verify</a>
          <a href="/login"  style={{ color: "var(--text-muted)", textDecoration: "none" }}>Login</a>
          <a href="/signup" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Sign Up</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", width: "100%" }}>
          <Code size={12} />
          Built on Ethereum Sepolia · Powered by IPFS · Open for audit
        </div>
      </footer>
    </div>
  );
}