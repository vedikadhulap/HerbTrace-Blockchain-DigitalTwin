import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const STEPS = [
  { icon: "🌿", role: "Farmer",      desc: "Records harvest batch: herb type, location, quantity, GPS coordinates" },
  { icon: "🧪", role: "Lab",         desc: "Tests the batch and records results on-chain: pesticide levels, moisture, certifications" },
  { icon: "⚙️", role: "Processor",   desc: "Combines raw batches into a processed product, linking all parent batches" },
  { icon: "🚚", role: "Distributor", desc: "Records the final custody transfer to the retailer, completing the on-chain trail" },
];

const WHY = [
  {
    icon: "🔒",
    title: "Tamper-Proof Records",
    body: "Once written to the blockchain, no one can quietly edit a batch record. Every change creates a new transaction.",
  },
  {
    icon: "📍",
    title: "GPS at Every Stage",
    body: "Location coordinates are captured and hashed at every step — farm, lab, processor, distributor. Provenance is provable, not just claimed.",
  },
  {
    icon: "📱",
    title: "Anyone Can Verify",
    body: "No app download. No account. A consumer scans the QR code on any phone and sees the full verified history instantly.",
  },
];

const ROLES = [
  { role: "farmer",      icon: "🌿", title: "Farmer",      desc: "Register your harvests on-chain. Upload Kisan ID or land papers to get approved." },
  { role: "lab",         icon: "🧪", title: "Lab",          desc: "Record test results for batches. Upload your accreditation certificate to get approved." },
  { role: "processor",   icon: "⚙️", title: "Processor",    desc: "Record processed batches and link their raw ingredients. Upload business registration." },
  { role: "distributor", icon: "🚚", title: "Distributor",  desc: "Record the final custody handoff to retailers. Upload your distribution license." },
];

function Home() {
  const navigate = useNavigate();
  const [consumerBatchId, setConsumerBatchId] = useState("");

  const handleConsumerVerify = (e) => {
    e.preventDefault();
    if (consumerBatchId.trim()) {
      navigate(`/verify/${consumerBatchId.trim()}`);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* ─── HERO ────────────────────────────────────────────── */}
      <section style={{
        minHeight: "92vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 24px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Radial glow behind text */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 60% 55% at 50% 40%, rgba(61,107,79,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 680 }}>
          <div style={{
            display: "inline-block",
            padding: "5px 16px",
            borderRadius: 999,
            background: "rgba(168,230,184,0.1)",
            border: "1px solid rgba(168,230,184,0.2)",
            fontSize: "0.8rem",
            color: "var(--fern-glow)",
            fontFamily: "var(--font-mono)",
            marginBottom: 28,
            letterSpacing: "0.05em",
          }}>
            ETHEREUM SEPOLIA TESTNET
          </div>

          <h1 style={{
            fontSize: "clamp(2.4rem, 6vw, 4rem)",
            lineHeight: 1.12,
            marginBottom: 20,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
          }}>
            From Soil to Shelf —{" "}
            <span style={{ color: "var(--fern-glow)" }}>Every Step Verified</span>
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2.5vw, 1.18rem)",
            color: "var(--paper-dim)",
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 540,
            margin: "0 auto 40px",
          }}>
            HerbTrace records every stage of your herbal product's journey on the Ethereum blockchain.
            Tamper-proof. GPS-verified. Scannable by anyone.
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/verify" className="btn-primary" style={{ fontSize: "1rem", padding: "15px 32px" }}>
              Verify a Batch
            </Link>
            <Link to="/signup" className="btn-outline" style={{ fontSize: "1rem", padding: "14px 32px" }}>
              Join as a Partner
            </Link>
          </div>
        </div>
      </section>

      {/* ─── TRUST BAR ───────────────────────────────────────── */}
      <section style={{
        display: "flex",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "0 24px 80px",
      }}>
        {["Ethereum Sepolia Testnet", "IPFS Document Storage", "GPS-Verified Locations"].map(label => (
          <span key={label} style={{
            padding: "8px 20px",
            borderRadius: 999,
            background: "var(--glass)",
            border: "1px solid var(--glass-border)",
            fontSize: "0.82rem",
            color: "var(--paper-dim)",
            fontFamily: "var(--font-mono)",
          }}>
            {label}
          </span>
        ))}
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem, 4vw, 2.2rem)", marginBottom: 16 }}>
          The Chain of Custody, Made Transparent
        </h2>
        <p style={{ textAlign: "center", color: "var(--paper-dim)", fontSize: "0.95rem", marginBottom: 56 }}>
          Every stage is recorded on-chain by a different wallet, making the entire trail independently verifiable.
        </p>

        {/* Steps row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0, justifyContent: "center", flexWrap: "wrap" }}>
          {STEPS.map((step, i) => (
            <div key={step.role} style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ textAlign: "center", width: 180 }}>
                <div style={{
                  width: 56, height: 56,
                  borderRadius: "50%",
                  background: "var(--glass)",
                  border: "1px solid var(--glass-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 14px",
                }}>
                  {step.icon}
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 8, color: "var(--fern-glow)" }}>
                  {step.role}
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--paper-dim)", lineHeight: 1.6, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: "0 0 40px",
                  height: 1,
                  borderTop: "2px dashed rgba(127,168,140,0.3)",
                  marginTop: 27,
                  alignSelf: "flex-start",
                }} />
              )}
            </div>
          ))}
        </div>

        <p style={{
          textAlign: "center",
          marginTop: 48,
          fontSize: "0.92rem",
          color: "var(--paper-dim)",
          fontStyle: "italic",
        }}>
          Then a consumer scans the QR code on the product and sees the entire journey instantly.
        </p>
      </section>

      {/* ─── WHY HERBTRACE ───────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.015)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem, 4vw, 2.2rem)", marginBottom: 48 }}>
            Why HerbTrace?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {WHY.map(card => (
              <div key={card.title} className="glass-panel" style={{ padding: "32px 28px" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 16 }}>{card.icon}</div>
                <h3 style={{ fontSize: "1.05rem", marginBottom: 10 }}>{card.title}</h3>
                <p style={{ color: "var(--paper-dim)", fontSize: "0.88rem", lineHeight: 1.7, margin: 0 }}>
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ROLE CARDS ──────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", maxWidth: 960, margin: "0 auto" }}>
        <h2 style={{ textAlign: "center", fontSize: "clamp(1.6rem, 4vw, 2.2rem)", marginBottom: 14 }}>
          Are you part of the supply chain?
        </h2>
        <p style={{ textAlign: "center", color: "var(--paper-dim)", fontSize: "0.92rem", marginBottom: 44 }}>
          Each role gets a dedicated dashboard. Accounts are reviewed by an admin before access is granted.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {ROLES.map(r => (
            <div key={r.role} className="glass-panel" style={{ padding: "28px 22px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>{r.icon}</div>
              <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{r.title}</h3>
              <p style={{ color: "var(--paper-dim)", fontSize: "0.83rem", lineHeight: 1.6, flex: 1, margin: "0 0 20px" }}>
                {r.desc}
              </p>
              <Link
                to={`/signup?role=${r.role}`}
                className="btn-outline"
                style={{ fontSize: "0.82rem", padding: "9px 16px", textAlign: "center" }}
              >
                Sign Up as {r.title}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CONSUMER VERIFY ─────────────────────────────────── */}
      <section style={{ padding: "0 24px 100px", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        <div className="glass-panel" style={{ padding: "40px 36px", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.4rem", marginBottom: 10 }}>Have a product?</h2>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.92rem", marginBottom: 28 }}>
            Enter or scan its batch ID to see the full verified history.
          </p>
          <form onSubmit={handleConsumerVerify} style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <input
              id="home-verify-input"
              type="text"
              value={consumerBatchId}
              onChange={e => setConsumerBatchId(e.target.value)}
              placeholder="e.g. ASHWAGANDHA-1723456789"
              className="field-input"
              style={{ flex: "1 1 260px", fontFamily: "var(--font-mono)", fontSize: "0.88rem" }}
            />
            <button type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
              Verify Batch
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

export default Home;