/**
 * MapModal.jsx — Route Map + Delay Table modal for a single batch.
 *
 * ZERO EMOJIS — all icons provided by lucide-react.
 * Features:
 *   1. react-leaflet map with:
 *      - Facility markers across Kerala stages
 *      - OSRM route polylines
 *      - Moving/static batch location circle marker
 *   2. Stage-to-Stage timing breakdown table via DelayTable
 */

import { useEffect } from "react";
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
import { MapPin, AlertTriangle, X, Route, Clock } from "lucide-react";
import DelayTable from "./DelayTable";

// Fix default Leaflet marker assets
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon   from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
});

const FACILITY_CONFIG = {
  Collected:   { label: "Herb Farm (Farmer)",     color: "#22c55e" },
  Tested:      { label: "Quality Laboratory",     color: "#3b82f6" },
  Processed:   { label: "Processing Plant",      color: "#f59e0b" },
  Distributed: { label: "Distribution Hub",     color: "#6366f1" },
};

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

function toLeafletLatLngs(geojsonCoords) {
  return geojsonCoords.map(([lng, lat]) => [lat, lng]);
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [map, bounds]);
  return null;
}

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
        GPS: {lat.toFixed(4)}, {lng.toFixed(4)}
      </Popup>
    </CircleMarker>
  );
}

function MapModal({ batch, locationMap, routes, onClose }) {
  const location  = locationMap?.[batch.batchId];
  const legsToShow = STATUS_TO_LEGS[batch.status] || [];

  const allLatLngs = [];
  for (const coords of Object.values(FACILITY_COORDS)) {
    allLatLngs.push([coords.lat, coords.lng]);
  }
  if (location) {
    allLatLngs.push([location.lat, location.lng]);
  }

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="dt-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="dt-modal">
        <div className="dt-modal-header">
          <div>
            <h2>
              <MapPin size={20} color="var(--forest)" />
              Route Map — {batch.batchId}
            </h2>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Current Stage: <strong>{batch.status}</strong>
              {batch.delayed && (
                <span className="dt-pill warning" style={{ marginLeft: 10 }}>
                  <AlertTriangle size={12} /> DELAYED
                </span>
              )}
            </span>
          </div>
          <button className="dt-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="dt-modal-body">
          <div className="dt-map-container">
            <MapContainer
              center={[10.3529, 76.2788]}
              zoom={8}
              style={{ width: "100%", height: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              <FitBounds bounds={allLatLngs} />

              {Object.entries(FACILITY_COORDS).map(([key, coords]) => {
                const info = FACILITY_CONFIG[key] || {};
                const isReached = (STATUS_TO_LEGS[batch.status] || []).length > 0;

                return (
                  <CircleMarker
                    key={key}
                    center={[coords.lat, coords.lng]}
                    radius={8}
                    pathOptions={{
                      color:       info.color || "#666",
                      fillColor:   info.color || "#666",
                      fillOpacity: isReached ? 0.95 : 0.4,
                      weight:      2,
                    }}
                  >
                    <Popup>
                      <strong>{coords.label}</strong>
                      <br />
                      Stage: {key}
                    </Popup>
                  </CircleMarker>
                );
              })}

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
                        ? "Straight-line estimate"
                        : `OSRM driving route (~${Math.round(route.durationSeconds / 60)} min)`}
                    </Popup>
                  </Polyline>
                );
              })}

              {location && (
                <BatchMarker
                  lat={location.lat}
                  lng={location.lng}
                  batchId={batch.batchId}
                  isStatic={location.isStatic !== false}
                />
              )}
            </MapContainer>
          </div>

          <div>
            <h3 style={{ margin: "0 0 10px", fontSize: "15px", color: "var(--forest)", display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={16} /> Stage-to-Stage Timing
            </h3>
            <DelayTable delayLegs={batch.delayLegs || []} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapModal;
