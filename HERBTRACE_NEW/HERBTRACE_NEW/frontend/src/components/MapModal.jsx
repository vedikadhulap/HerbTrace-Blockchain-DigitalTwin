/**
 * MapModal.jsx — Route Map + Delay Table modal for a single batch.
 *
 * Opens when the user clicks "View on Map" on a batch card.
 * Shows:
 *   1. react-leaflet MapContainer with:
 *      - Facility markers for each supply chain stage
 *      - OSRM route polyline overlay for all completed + current legs
 *      - Animated marker at the batch's current GPS position
 *   2. DelayTable with per-leg timing breakdown
 *
 * Props:
 *   batch       — the batch object from App state
 *   locationMap — Map: batchId → { lat, lng, legKey, progress, isStatic }
 *   routes      — Map: legKey  → { geometry (GeoJSON), durationSeconds, isFallback }
 *   onClose     — callback to close the modal
 *
 * OSRM coordinate order note:
 *   OSRM / GeoJSON stores coordinates as [lng, lat].
 *   Leaflet wants [lat, lng].
 *   This component converts at render time.
 */

import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DelayTable from "./DelayTable";

// ─── Fix default marker icon (Vite / Webpack asset issue) ────────────────────
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
});

// ─── Facility definitions (matches facilityRegistry.js) ──────────────────────

const FACILITY_ICONS = {
  Collected:   { emoji: "🌱", color: "#22c55e" },
  Tested:      { emoji: "🔬", color: "#3b82f6" },
  Processed:   { emoji: "⚙️",  color: "#f59e0b" },
  Distributed: { emoji: "🚚", color: "#6366f1" },
};

// Status → ordered list of legs to draw on the map
const STATUS_TO_LEGS = {
  Collected:   ["leg1"],
  Tested:      ["leg1", "leg2"],
  Processed:   ["leg1", "leg2", "leg3"],
  Distributed: ["leg1", "leg2", "leg3"],
};

const LEG_COLORS = {
  leg1: "#22c55e",
  leg2: "#3b82f6",
  leg3: "#f59e0b",
  leg4: "#6366f1",
};

const FACILITY_COORDS = {
  Collected:   { lat: 10.8505, lng: 76.2711, label: "Herb Farm (Farmer)" },
  Tested:      { lat: 10.0159, lng: 76.3419, label: "Quality Laboratory" },
  Processed:   { lat: 10.5276, lng: 76.2144, label: "Processing Plant" },
  Distributed: { lat: 9.9312,  lng: 76.2673, label: "Distribution Hub" },
};

// ─── Helper: GeoJSON [lng, lat] → Leaflet [lat, lng] ─────────────────────────

function toLeafletLatLngs(geojsonCoords) {
  return geojsonCoords.map(([lng, lat]) => [lat, lng]);
}

// ─── Map fit-bounds helper component ─────────────────────────────────────────

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, bounds]);
  return null;
}

// ─── Custom batch position marker ─────────────────────────────────────────────

function BatchMarker({ lat, lng, batchId, isStatic }) {
  const color = isStatic ? "#94a3b8" : "#ef4444";
  return (
    <CircleMarker
      center={[lat, lng]}
      radius={10}
      pathOptions={{
        color,
        fillColor: color,
        fillOpacity: 0.9,
        weight: 2,
      }}
    >
      <Popup>
        <strong>{batchId}</strong>
        <br />
        {isStatic ? "At facility" : "In transit"}
        <br />
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </Popup>
    </CircleMarker>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function MapModal({ batch, locationMap, routes, onClose }) {
  const location  = locationMap?.[batch.batchId];
  const legsToShow = STATUS_TO_LEGS[batch.status] || [];

  // Collect all coordinates for auto-fitting the map
  const allLatLngs = [];

  // Add facility markers to bounds
  for (const [key, coords] of Object.entries(FACILITY_COORDS)) {
    allLatLngs.push([coords.lat, coords.lng]);
  }

  // Add current location to bounds
  if (location) {
    allLatLngs.push([location.lat, location.lng]);
  }

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="map-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Map for batch ${batch.batchId}`}
    >
      <div className="map-modal">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="map-modal-header">
          <div>
            <h2 className="map-modal-title">
              📍 Route Map — {batch.batchId}
            </h2>
            <span className="map-modal-subtitle">
              Status: <strong>{batch.status}</strong>
              {batch.delayed && (
                <span className="delay-pill" style={{ marginLeft: 8 }}>
                  ⚠️ DELAYED
                </span>
              )}
            </span>
          </div>
          <button
            className="map-modal-close"
            onClick={onClose}
            aria-label="Close map"
          >
            ✕
          </button>
        </div>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <div className="map-modal-map">
          <MapContainer
            center={[10.3529, 76.2788]} // centre of Kerala
            zoom={8}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {/* Auto-fit the map to all relevant coordinates */}
            <FitBounds bounds={allLatLngs} />

            {/* ── Facility markers ─────────────────────────────────── */}
            {Object.entries(FACILITY_COORDS).map(([key, coords]) => {
              const iconInfo = FACILITY_ICONS[key] || {};
              const isReached = (STATUS_TO_LEGS[batch.status] || [])
                .some((leg) =>
                  (leg === "leg1" && (key === "Collected" || key === "Tested")) ||
                  (leg === "leg2" && (key === "Tested"    || key === "Processed")) ||
                  (leg === "leg3" && (key === "Processed" || key === "Distributed"))
                ) || batch.status === key;

              return (
                <CircleMarker
                  key={key}
                  center={[coords.lat, coords.lng]}
                  radius={8}
                  pathOptions={{
                    color:       iconInfo.color || "#666",
                    fillColor:   iconInfo.color || "#666",
                    fillOpacity: isReached ? 0.95 : 0.35,
                    weight:      2,
                  }}
                >
                  <Popup>
                    <strong>{iconInfo.emoji} {coords.label}</strong>
                    <br />
                    Stage: {key}
                    <br />
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* ── Route polylines ──────────────────────────────────── */}
            {legsToShow.map((legKey) => {
              const route = routes?.[legKey];
              if (!route || !route.geometry?.coordinates) return null;

              const latLngs = toLeafletLatLngs(route.geometry.coordinates);
              return (
                <Polyline
                  key={legKey}
                  positions={latLngs}
                  pathOptions={{
                    color:     LEG_COLORS[legKey] || "#888",
                    weight:    route.isFallback ? 2 : 4,
                    opacity:   0.85,
                    dashArray: route.isFallback ? "6 6" : null,
                  }}
                >
                  <Popup>
                    {route.isFallback
                      ? "⚠️ Straight-line estimate (OSRM unavailable)"
                      : `🗺️ OSRM road route — ~${Math.round(route.durationSeconds / 60)} min`}
                  </Popup>
                </Polyline>
              );
            })}

            {/* ── Current batch position ───────────────────────────── */}
            {location && (
              <BatchMarker
                lat={location.lat}
                lng={location.lng}
                batchId={batch.batchId}
                isStatic={location.isStatic !== false ? true : false}
              />
            )}
          </MapContainer>
        </div>

        {/* ── Delay Table ────────────────────────────────────────────────── */}
        <div className="map-modal-delay">
          <h3 className="map-modal-section-title">
            ⏱ Stage-to-Stage Timing
          </h3>
          <DelayTable delayLegs={batch.delayLegs || []} />
        </div>
      </div>
    </div>
  );
}

export default MapModal;
