import { useState, useEffect } from "react";
import { MapPin, MapPinOff, Loader } from "lucide-react";

/**
 * GPSBar — silently captures GPS coordinates on mount.
 *
 * Props:
 *   onCoordsChange(coords | null)   — called with raw { latitude, longitude } for backend use
 *   onPlaceResolved(placeName | null) — called with human-readable place name once available
 *                                       (the parent can show this as a read-only banner)
 *
 * Coordinates are NEVER displayed to the user. Only the resolved place name (if any)
 * is shown, and only as a status label — never editable.
 */
function GPSBar({ onCoordsChange, onPlaceResolved }) {
  const [status, setStatus] = useState("getting"); // getting | captured | unavailable

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      onCoordsChange(null);
      if (onPlaceResolved) onPlaceResolved(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setStatus("captured");
        onCoordsChange(c);
        // onPlaceResolved is called by the parent after the oracle resolves
        // GPSBar itself doesn't call the backend — it just forwards raw coords
      },
      () => {
        setStatus("unavailable");
        onCoordsChange(null);
        if (onPlaceResolved) onPlaceResolved(null);
      },
      { timeout: 10000 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 20,
      padding: "8px 14px", borderRadius: 10,
      background: status === "captured" ? "var(--fern-dim)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${status === "captured" ? "var(--border-glow)" : "var(--border)"}`,
    }}>
      {status === "getting" && (
        <>
          <Loader size={14} className="spin" />
          <span>Getting your location…</span>
        </>
      )}
      {status === "captured" && (
        <>
          <MapPin size={14} color="var(--fern)" />
          <span style={{ color: "var(--fern)", fontWeight: 500 }}>Location captured</span>
        </>
      )}
      {status === "unavailable" && (
        <>
          <MapPinOff size={14} />
          <span>Location unavailable — proceeding without GPS</span>
        </>
      )}
    </div>
  );
}

export default GPSBar;
