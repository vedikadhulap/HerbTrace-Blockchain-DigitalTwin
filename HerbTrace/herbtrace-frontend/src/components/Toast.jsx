import { useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";

function Toast({ message, type = "success", onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fade-in"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 1000,
        padding: "14px 20px", borderRadius: 14,
        display: "flex", alignItems: "center", gap: 10,
        background: type === "success" ? "var(--moss)" : "#7A2D2D",
        color: "var(--text-primary)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        border: `1px solid ${type === "success" ? "var(--border-glow)" : "rgba(255,128,128,0.2)"}`,
        fontSize: "0.9rem", fontWeight: 500, maxWidth: 320,
      }}
    >
      {type === "success"
        ? <CheckCircle size={16} style={{ flexShrink: 0 }} />
        : <XCircle     size={16} style={{ flexShrink: 0 }} />
      }
      {message}
    </div>
  );
}

export default Toast;
