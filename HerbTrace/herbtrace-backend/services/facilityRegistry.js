/**
 * facilityRegistry.js — Static configuration for supply chain facility locations.
 *
 * Configured coordinates represent physical Ayurvedic supply chain stages:
 *   Collected → Tested → Processed → Distributed
 */

const FACILITIES = {
  Collected: {
    name: "Herb Farm (Farmer)",
    lat: 10.8505,
    lng: 76.2711,
  },
  Tested: {
    name: "Quality Laboratory",
    lat: 10.0159,
    lng: 76.3419,
  },
  Processed: {
    name: "Processing Plant",
    lat: 10.5276,
    lng: 76.2144,
  },
  Distributed: {
    name: "Distribution Hub",
    lat: 9.9312,
    lng: 76.2673,
  },
  RetailPoint: {
    name: "Retail / Delivery Point (simulation)",
    lat: 9.5916,
    lng: 76.5222,
  },
};

const STAGE_SEQUENCE = ["Collected", "Tested", "Processed", "Distributed"];

const LEGS = [
  { key: "leg1", from: "Collected", to: "Tested",     label: "Collected → Tested" },
  { key: "leg2", from: "Tested",    to: "Processed",  label: "Tested → Processed" },
  { key: "leg3", from: "Processed", to: "Distributed", label: "Processed → Distributed" },
  { key: "leg4", from: "Distributed", to: "RetailPoint", label: "Distributed → Retail" },
];

module.exports = { FACILITIES, STAGE_SEQUENCE, LEGS };
