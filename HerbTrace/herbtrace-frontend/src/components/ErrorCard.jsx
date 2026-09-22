import { AlertTriangle, AlertCircle } from "lucide-react";

function ErrorCard({ error }) {
  if (!error) return null;

  const isGPS = error.includes("GPS location mismatch");

  return (
    <div style={{
      marginTop: 16, padding: "16px 20px", borderRadius: 12,
      display: "flex", alignItems: "flex-start", gap: 10,
      border:      isGPS ? "1px solid rgba(255,180,100,0.3)" : "1px solid rgba(255,128,128,0.2)",
      background:  isGPS ? "var(--warning-dim)"              : "var(--danger-dim)",
      color:       isGPS ? "var(--warning)"                  : "var(--danger)",
      fontSize: "0.88rem", lineHeight: 1.5,
    }}>
      {isGPS
        ? <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        : <AlertCircle   size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      }
      <span>{error}</span>
    </div>
  );
}

export default ErrorCard;
