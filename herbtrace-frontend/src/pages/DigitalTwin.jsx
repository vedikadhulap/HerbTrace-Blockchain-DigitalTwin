/**
 * DigitalTwin.jsx — HerbTrace Digital Twin LIVE SUPPLY CHAIN MONITORING
 *
 * Primary Map-Hero View (65-80% viewport height).
 * Live active batch tracking synchronized with Sepolia smart contract events via Socket.IO.
 *
 * Requirements:
 *   1. Clean OpenStreetMap TileLayer (NO CARTO API key watermarks or paid providers).
 *   2. ZERO third-party branding (NO Rapido / ride tracking names).
 *   3. NO hardcoded Kerala presentation — uses actual batch GPS coordinates from MongoDB/blockchain.
 *   4. ONLY ACTIVE BATCHES on the live tracking map (Distributed/Completed batches placed in History).
 *   5. Robust Socket.IO reconnect handling without console error spam.
 *   6. ZERO UNICODE EMOJIS — 100% lucide-react vector icons.
 */

import { useEffect, useMemo, useState, useRef } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Radio,
  Package,
  Zap,
  AlertTriangle,
  Truck,
  Activity,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Eye,
  Search,
  Check,
  FileText,
} from "lucide-react";
import DelayTable from "../components/DelayTable";
import "../DigitalTwin.css";

const SOCKET_URL = "http://localhost:5000";

// Default supply chain facility nodes
const DEFAULT_FACILITIES = {
  Collected:   { lat: 10.8505, lng: 76.2711, label: "Farmer Harvest Node", role: "Origin Harvest Site" },
  Tested:      { lat: 10.0159, lng: 76.3419, label: "Quality Lab Node", role: "Testing & Inspection Lab" },
  Processed:   { lat: 10.5276, lng: 76.2144, label: "Processing Facility Node", role: "Extraction Plant" },
  Distributed: { lat: 9.9312,  lng: 76.2673, label: "Distribution Center", role: "Final Logistics Hub" },
};

const STAGE_ORDER = ["Collected", "Tested", "Processed", "Distributed"];

const LEG_DESCRIPTIONS = {
  Collected: "Farmer Harvest -> Testing Lab",
  Tested:    "Testing Lab -> Processing Plant",
  Processed: "Processing Plant -> Distribution Hub",
};

const LEG_COLORS = {
  leg1: "#10b981", // Emerald green
  leg2: "#3b82f6", // Royal blue
  leg3: "#f59e0b", // Amber
};

// Helper: Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
function toLeafletLatLngs(coords) {
  if (!coords) return [];
  return coords.map(([lng, lat]) => [lat, lng]);
}

// Helper: Compute dynamic center & bounds from active batches
function MapCameraController({ selectedBatch, locationMap, activeBatches }) {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  // Auto-fit bounds on initial load if active batches with GPS exist
  useEffect(() => {
    if (hasCenteredRef.current) return;
    const validBatches = activeBatches.filter(
      (b) => (locationMap[b.batchId]?.lat ?? b.currentLat) != null
    );

    if (validBatches.length === 1) {
      const b = validBatches[0];
      const lat = locationMap[b.batchId]?.lat ?? b.currentLat;
      const lng = locationMap[b.batchId]?.lng ?? b.currentLng;
      map.setView([lat, lng], 10);
      hasCenteredRef.current = true;
    } else if (validBatches.length > 1) {
      const bounds = L.latLngBounds(
        validBatches.map((b) => [
          locationMap[b.batchId]?.lat ?? b.currentLat,
          locationMap[b.batchId]?.lng ?? b.currentLng,
        ])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
      hasCenteredRef.current = true;
    }
  }, [activeBatches, locationMap, map]);

  // Pan to selected batch on user click
  useEffect(() => {
    if (!selectedBatch) return;
    const loc = locationMap[selectedBatch.batchId];
    const lat = loc?.lat ?? selectedBatch.currentLat;
    const lng = loc?.lng ?? selectedBatch.currentLng;

    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 12, { animate: true, duration: 1.2 });
    }
  }, [selectedBatch, locationMap, map]);

  return null;
}

// Custom Leaflet DivIcon generator for active batch markers
function createMovingBatchIcon(status, delayed, isSelected) {
  let color = "#10b981"; // green
  if (status === "Tested") color = "#3b82f6";
  if (status === "Processed") color = "#f59e0b";
  if (delayed) color = "#ef4444";

  const size = isSelected ? 44 : 36;
  const pulseClass = isSelected ? "dt-marker-pulse active" : "dt-marker-pulse";

  return L.divIcon({
    className: "dt-custom-leaflet-icon",
    html: `
      <div class="dt-marker-container">
        <div class="${pulseClass}" style="background-color: ${color}; opacity: 0.4;"></div>
        <div class="dt-marker-body" style="background-color: ${color}; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function DigitalTwin() {
  const [connected, setConnected]             = useState(false);
  const [batches, setBatches]                 = useState([]);
  const [events, setEvents]                   = useState([]);
  const [locationMap, setLocationMap]         = useState({});
  const [routes, setRoutes]                   = useState({});
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [activeTab, setActiveTab]             = useState("live"); // "live" | "history"
  const [searchQuery, setSearchQuery]         = useState("");

  const routesRef = useRef({});
  useEffect(() => { routesRef.current = routes; }, [routes]);

  // Connect Socket.IO with robust reconnect parameters
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 30,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to Digital Twin backend");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] Disconnected from Digital Twin backend");
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.warn("[SOCKET] Connection attempt pending...");
      setConnected(false);
    });

    socket.on("state:snapshot", (data) => {
      const snapshotBatches = data.batches || [];
      const snapshotRoutes  = data.routes  || {};

      setBatches(snapshotBatches);
      setRoutes(snapshotRoutes);

      const initLoc = {};
      for (const b of snapshotBatches) {
        if (b.currentLat != null && b.currentLng != null) {
          initLoc[b.batchId] = {
            lat:              b.currentLat,
            lng:              b.currentLng,
            placeName:        b.placeName || null,
            coordinateSource: b.coordinateSource || (b.hasGps ? "MONGODB REAL GPS" : "LOCATION UNAVAILABLE"),
            legKey:           null,
            progress:         null,
            isStatic:         true,
          };
        }
      }
      setLocationMap(initLoc);

      const snapshotEvents = snapshotBatches.map((batch) => ({
        id:        `snapshot-${batch.batchId}`,
        type:      "State Synced",
        batchId:   batch.batchId,
        details:   batch.status === "Distributed" ? "Delivery Complete" : `Active at ${batch.status}`,
        status:    batch.status,
        timestamp: batch.lastUpdated ? new Date(batch.lastUpdated * 1000).toLocaleTimeString() : "—",
      }));

      setEvents(snapshotEvents);
    });

    socket.on("batch:updated", (data) => {
      setBatches((prev) => {
        const exists = prev.some((b) => b.batchId === data.batchId);
        if (exists) {
          return prev.map((b) =>
            b.batchId === data.batchId
              ? {
                  ...b,
                  status:           data.status,
                  currentOwner:     data.currentOwner,
                  dataHash:         data.dataHash,
                  parents:          data.parents   || b.parents,
                  delayed:          data.delayed   || false,
                  delayLegs:        data.delayLegs || [],
                  currentLat:       data.currentLat != null ? data.currentLat : b.currentLat,
                  currentLng:       data.currentLng != null ? data.currentLng : b.currentLng,
                  placeName:        data.placeName || b.placeName,
                  coordinateSource: data.coordinateSource || b.coordinateSource,
                  isLive:           true,
                }
              : b
          );
        }
        return [
          ...prev,
          {
            batchId:          data.batchId,
            status:           data.status,
            currentOwner:     data.currentOwner,
            dataHash:         data.dataHash,
            parents:          data.parents   || [],
            delayed:          data.delayed   || false,
            delayLegs:        data.delayLegs || [],
            currentLat:       data.currentLat,
            currentLng:       data.currentLng,
            placeName:        data.placeName,
            coordinateSource: data.coordinateSource || "MONGODB REAL GPS",
            isLive:           true,
          },
        ];
      });

      if (data.currentLat != null && data.currentLng != null) {
        setLocationMap((prev) => ({
          ...prev,
          [data.batchId]: {
            lat:              data.currentLat,
            lng:              data.currentLng,
            placeName:        data.placeName || null,
            coordinateSource: data.coordinateSource || "MONGODB REAL GPS",
            legKey:           null,
            progress:         null,
            isStatic:         true,
          },
        }));
      }

      setEvents((prev) => [
        {
          id:        Date.now(),
          type:      data.status === "Distributed" ? "Delivery Complete" : "Stage Transition",
          batchId:   data.batchId,
          details:   `Batch Stage → ${data.status}`,
          status:    data.status,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    });

    socket.on("batch:location", (data) => {
      setLocationMap((prev) => ({
        ...prev,
        [data.batchId]: {
          lat:              data.lat,
          lng:              data.lng,
          legKey:           data.legKey,
          progress:         data.progress,
          coordinateSource: data.coordinateSource || "SIMULATED MOVEMENT",
          isFallback:       data.isFallback,
          isStatic:         false,
        },
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Filter Active vs Completed/Historical Batches
  const activeBatches = useMemo(() => {
    return batches.filter((b) => b.status !== "Distributed");
  }, [batches]);

  const completedBatches = useMemo(() => {
    return batches.filter((b) => b.status === "Distributed");
  }, [batches]);

  // Selected batch reference
  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) return activeBatches[0] || null;
    return batches.find((b) => b.batchId === selectedBatchId) || activeBatches[0] || null;
  }, [selectedBatchId, batches, activeBatches]);

  // Filtered batch lists for search
  const filteredActiveBatches = useMemo(() => {
    if (!searchQuery) return activeBatches;
    return activeBatches.filter((b) =>
      b.batchId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeBatches, searchQuery]);

  const filteredCompletedBatches = useMemo(() => {
    if (!searchQuery) return completedBatches;
    return completedBatches.filter((b) =>
      b.batchId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [completedBatches, searchQuery]);

  // Metrics
  const delayedCount = useMemo(
    () => activeBatches.filter((b) => b.delayed).length,
    [activeBatches]
  );

  const movingCount = useMemo(
    () => Object.values(locationMap).filter((loc) => loc && !loc.isStatic).length,
    [locationMap]
  );

  // Default initial center calculated from first valid active batch, or fallback India center [20.5937, 78.9629]
  const initialCenter = useMemo(() => {
    const firstWithGps = activeBatches.find((b) => b.currentLat != null && b.currentLng != null);
    if (firstWithGps) {
      return [firstWithGps.currentLat, firstWithGps.currentLng];
    }
    return [20.5937, 78.9629]; // Neutral India Center
  }, [activeBatches]);

  return (
    <div className="dt-maphero-root">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="dt-topbar">
        <div className="dt-brand">
          <div className="dt-brand-mark">
            <Navigation size={20} color="white" />
          </div>
          <div>
            <h1>HerbTrace Digital Twin</h1>
            <span>LIVE SUPPLY CHAIN MONITORING</span>
          </div>
        </div>

        <div className="dt-topbar-center">
          <div className="dt-tab-switch">
            <button
              className={`dt-tab-btn ${activeTab === "live" ? "active" : ""}`}
              onClick={() => setActiveTab("live")}
            >
              <Radio size={14} className={activeTab === "live" ? "dt-pulse-icon" : ""} />
              Live Map ({activeBatches.length})
            </button>
            <button
              className={`dt-tab-btn ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <CheckCircle2 size={14} />
              Completed History ({completedBatches.length})
            </button>
          </div>
        </div>

        <div className="dt-network-status">
          <span className={`dt-network-dot ${connected ? "online" : "offline"}`} />
          <div>
            <strong>{connected ? "LIVE SYNCHRONIZATION ACTIVE" : "RECONNECTING"}</strong>
            <span>Ethereum Sepolia · Contract Active</span>
          </div>
        </div>
      </header>

      {/* ── MAIN HERO MAP VIEW (65-80% HEIGHT) ── */}
      <div className="dt-maphero-container">
        {/* LEAFLET MAP HERO */}
        <div className="dt-maphero-viewport">
          <MapContainer
            center={initialCenter}
            zoom={6}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
          >
            {/* Standard OpenStreetMap Tile Layer (NO API Key required, NO Carto watermarks) */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            <MapCameraController
              selectedBatch={selectedBatch}
              locationMap={locationMap}
              activeBatches={activeBatches}
            />

            {/* OSRM Route Polylines for Active Legs */}
            {["leg1", "leg2", "leg3"].map((legKey) => {
              const route = routes?.[legKey];
              if (!route || !route.geometry?.coordinates) return null;
              const latLngs = toLeafletLatLngs(route.geometry.coordinates);

              return (
                <Polyline
                  key={legKey}
                  positions={latLngs}
                  pathOptions={{
                    color:     LEG_COLORS[legKey] || "#3b82f6",
                    weight:    4,
                    opacity:   0.8,
                    dashArray: route.isFallback ? "8 8" : null,
                  }}
                >
                  <Popup className="dt-leaflet-popup">
                    <div className="dt-popup-card">
                      <span className="dt-popup-tag">OSRM HIGHWAY ROUTE</span>
                      <h4>{legKey.toUpperCase()} Path</h4>
                      <p>{route.isFallback ? "Straight-line estimation" : "OSRM navigation route"}</p>
                      <small>Est. Duration: ~{Math.round((route.durationSeconds || 0) / 60)} mins</small>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}

            {/* Moving Active Batch Markers (ONLY ACTIVE BATCHES RENDERED ON LIVE MAP) */}
            {activeBatches.map((batch) => {
              const loc = locationMap[batch.batchId];
              const lat = loc?.lat ?? batch.currentLat;
              const lng = loc?.lng ?? batch.currentLng;
              if (lat == null || lng == null) return null;

              const coordSource = loc?.coordinateSource || batch.coordinateSource || "MONGODB REAL GPS";

              console.log("[DIGITAL TWIN MAP MARKER]", {
                batchId: batch.batchId,
                lat,
                lng,
                source: coordSource,
              });

              const isSelected = selectedBatch?.batchId === batch.batchId;
              const isMoving = loc && loc.isStatic === false;
              const placeName = batch.placeName || loc?.placeName || null;

              return (
                <Marker
                  key={batch.batchId}
                  position={[lat, lng]}
                  icon={createMovingBatchIcon(batch.status, batch.delayed, isSelected)}
                  eventHandlers={{
                    click: () => setSelectedBatchId(batch.batchId),
                  }}
                >
                  <Popup className="dt-leaflet-popup">
                    <div className="dt-popup-card">
                      <div className="dt-popup-header">
                        <span className="dt-popup-tag active">ACTIVE SHIPMENT</span>
                        {batch.delayed && (
                          <span className="dt-pill warning" style={{ padding: "2px 6px", fontSize: "10px" }}>
                            <AlertTriangle size={10} /> DELAYED
                          </span>
                        )}
                      </div>
                      <h3>{batch.batchId}</h3>
                      <div className="dt-popup-meta">
                        <div>
                          <span>Current Stage</span>
                          <strong>{batch.status}</strong>
                        </div>
                        <div>
                          <span>GPS Source</span>
                          <strong style={{ color: "#10b981", fontSize: "11px" }}>{coordSource}</strong>
                        </div>
                      </div>
                      <div className="dt-popup-coords">
                        <MapPin size={12} />
                        <span>{placeName ? `${placeName} (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Quick Map Controls Overlay */}
          <div className="dt-map-overlay-controls">
            <div className="dt-map-badge">
              <span className="dt-live-dot" />
              <strong>LIVE TRACKING MAP</strong>
              <span>{activeBatches.length} active markers</span>
            </div>
          </div>
        </div>

        {/* ── FLOATING OVERLAY PANEL (SIDEBAR) ── */}
        <aside className="dt-sidebar-panel">
          {/* KPI STATS CARD */}
          <div className="dt-kpi-grid">
            <div className="dt-kpi-card">
              <div className="dt-kpi-icon active">
                <Zap size={16} />
              </div>
              <div>
                <span>Active Batches</span>
                <strong>{activeBatches.length}</strong>
              </div>
            </div>

            <div className="dt-kpi-card">
              <div className="dt-kpi-icon transit">
                <Truck size={16} />
              </div>
              <div>
                <span>In Transit</span>
                <strong>{movingCount}</strong>
              </div>
            </div>

            <div className="dt-kpi-card warning">
              <div className="dt-kpi-icon delay">
                <AlertTriangle size={16} />
              </div>
              <div>
                <span>Delayed</span>
                <strong>{delayedCount}</strong>
              </div>
            </div>

            <div className="dt-kpi-card success">
              <div className="dt-kpi-icon complete">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span>Delivered</span>
                <strong>{completedBatches.length}</strong>
              </div>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="dt-search-box">
            <Search size={14} color="var(--muted)" />
            <input
              type="text"
              placeholder="Search active batch ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* TAB 1: LIVE ACTIVE BATCHES LIST */}
          {activeTab === "live" && (
            <div className="dt-batch-list-container">
              <div className="dt-section-title">
                <span>ACTIVE SHIPMENTS ({filteredActiveBatches.length})</span>
                <span className="dt-live-pill">REAL-TIME</span>
              </div>

              {filteredActiveBatches.length === 0 ? (
                <div className="dt-empty-panel">
                  <Package size={32} color="var(--muted)" />
                  <h4>NO ACTIVE BATCHES IN TRANSIT</h4>
                  <p>
                    All existing batches have reached final delivery. Create a new batch on the creation form to begin live tracking!
                  </p>
                </div>
              ) : (
                <div className="dt-batch-cards-scroll">
                  {filteredActiveBatches.map((batch) => {
                    const isSelected = selectedBatch?.batchId === batch.batchId;
                    const loc = locationMap[batch.batchId];
                    const isMoving = loc && loc.isStatic === false;

                    return (
                      <motion.div
                        key={batch.batchId}
                        className={`dt-batch-item ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedBatchId(batch.batchId)}
                        whileHover={{ scale: 1.01 }}
                      >
                        <div className="dt-batch-item-head">
                          <div className="dt-batch-id">
                            <Truck size={14} color={isMoving ? "#10b981" : "var(--forest)"} />
                            <strong>{batch.batchId}</strong>
                          </div>
                          <span className={`dt-stage-tag ${batch.status.toLowerCase()}`}>
                            {batch.status}
                          </span>
                        </div>

                        <div className="dt-batch-item-body">
                          <div className="dt-route-mini">
                            <span>{LEG_DESCRIPTIONS[batch.status] || "In Transit"}</span>
                            {isMoving && <span className="dt-moving-badge">MOVING</span>}
                          </div>

                          {batch.placeName && (
                            <div className="dt-place-mini" style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                              <MapPin size={10} style={{ display: "inline", marginRight: "3px" }} />
                              {batch.placeName}
                            </div>
                          )}

                          {batch.delayed && (
                            <div className="dt-delay-mini">
                              <AlertTriangle size={12} />
                              <span>Transit Delay Detected</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPLETED HISTORY LIST */}
          {activeTab === "history" && (
            <div className="dt-batch-list-container">
              <div className="dt-section-title">
                <span>COMPLETED / DELIVERED BATCHES ({filteredCompletedBatches.length})</span>
                <span className="dt-history-pill">HISTORICAL</span>
              </div>

              {filteredCompletedBatches.length === 0 ? (
                <div className="dt-empty-panel">
                  <FileText size={32} color="var(--muted)" />
                  <h4>NO COMPLETED BATCHES YET</h4>
                  <p>Completed batches will appear here once final custody transfer occurs.</p>
                </div>
              ) : (
                <div className="dt-batch-cards-scroll">
                  {filteredCompletedBatches.map((batch) => (
                    <div key={batch.batchId} className="dt-batch-item completed">
                      <div className="dt-batch-item-head">
                        <div className="dt-batch-id">
                          <CheckCircle2 size={14} color="#10b981" />
                          <strong>{batch.batchId}</strong>
                        </div>
                        <span className="dt-stage-tag completed">Delivered</span>
                      </div>
                      <div className="dt-batch-item-body">
                        <small>Owner: {batch.currentOwner?.slice(0, 10)}...</small>
                        <div className="dt-data-hash">Hash: {batch.dataHash?.slice(0, 16)}...</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SELECTED BATCH DETAIL PANEL */}
          {selectedBatch && activeTab === "live" && (
            <div className="dt-selected-detail-card">
              <div className="dt-detail-header">
                <div>
                  <span className="dt-kicker">Selected Active Batch</span>
                  <h3>{selectedBatch.batchId}</h3>
                </div>
                <button
                  className="dt-focus-btn"
                  onClick={() => {
                    const loc = locationMap[selectedBatch.batchId];
                    if (loc) setSelectedBatchId(selectedBatch.batchId);
                  }}
                >
                  <Eye size={14} /> Focus Map
                </button>
              </div>

              {/* STAGE PIPELINE STEPS */}
              <div className="dt-mini-pipeline">
                {STAGE_ORDER.map((stage, idx) => {
                  const currentIdx = STAGE_ORDER.indexOf(selectedBatch.status);
                  const isDone = idx < currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div
                      key={stage}
                      className={`dt-pipeline-step ${isDone ? "done" : isCurrent ? "active" : ""}`}
                    >
                      <div className="dt-step-icon">
                        {isDone ? <Check size={10} /> : <span>{idx + 1}</span>}
                      </div>
                      <span className="dt-step-label">{stage}</span>
                    </div>
                  );
                })}
              </div>

              {/* DATA LINEAGE AUDIT DEBUG PANEL */}
              {(() => {
                const loc = locationMap[selectedBatch.batchId];
                const lat = loc?.lat ?? selectedBatch.currentLat;
                const lng = loc?.lng ?? selectedBatch.currentLng;
                const source = loc?.coordinateSource || selectedBatch.coordinateSource || (lat != null ? "MONGODB REAL GPS" : "LOCATION UNAVAILABLE");
                const isSimulating = loc && loc.isStatic === false;

                return (
                  <div className="dt-data-lineage-panel" style={{
                    marginTop: "12px",
                    padding: "10px",
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    borderRadius: "8px",
                    fontSize: "11px",
                    color: "#cbd5e1"
                  }}>
                    <div style={{ fontWeight: "700", color: "#60a5fa", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Activity size={12} /> DATA LINEAGE AUDIT PANEL
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px" }}>
                      <div><strong>Selected Batch:</strong> <span style={{ color: "#fff" }}>{selectedBatch.batchId}</span></div>
                      <div><strong>GPS Source:</strong> <span style={{ color: source.includes("REAL GPS") ? "#10b981" : "#f59e0b", fontWeight: "600" }}>{source}</span></div>
                      <div><strong>Latitude:</strong> <span style={{ color: "#38bdf8" }}>{lat != null ? lat.toFixed(6) : "N/A"}</span></div>
                      <div><strong>Longitude:</strong> <span style={{ color: "#38bdf8" }}>{lng != null ? lng.toFixed(6) : "N/A"}</span></div>
                      <div><strong>Place Name:</strong> <span style={{ color: "#e2e8f0" }}>{selectedBatch.placeName || loc?.placeName || "N/A"}</span></div>
                      <div><strong>Current Stage:</strong> <span style={{ color: "#a855f7" }}>{selectedBatch.status}</span></div>
                      <div style={{ gridColumn: "span 2" }}><strong>Simulation Movement:</strong> <span style={{ color: isSimulating ? "#10b981" : "#94a3b8" }}>{isSimulating ? "ON (Layered on real GPS)" : "OFF (Static Real GPS)"}</span></div>
                    </div>
                  </div>
                );
              })()}

              {/* TIMING BREAKDOWN TABLE */}
              {selectedBatch.delayLegs && selectedBatch.delayLegs.length > 0 && (
                <div className="dt-mini-timing">
                  <div className="dt-mini-title">
                    <Clock size={12} /> Stage Delay Analysis
                  </div>
                  <DelayTable delayLegs={selectedBatch.delayLegs} />
                </div>
              )}
            </div>
          )}

          {/* LIVE EVENT FEED STREAM */}
          <div className="dt-activity-feed-container">
            <div className="dt-section-title">
              <span>BLOCKCHAIN EVENT STREAM</span>
              <Activity size={12} color="var(--forest)" />
            </div>
            <div className="dt-activity-list">
              {events.slice(0, 3).map((ev) => (
                <div key={ev.id} className="dt-activity-mini-item">
                  <div className="dt-act-icon">
                    <Activity size={12} />
                  </div>
                  <div className="dt-act-content">
                    <strong>{ev.batchId}</strong>
                    <span>{ev.details}</span>
                  </div>
                  <time>{ev.timestamp}</time>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
