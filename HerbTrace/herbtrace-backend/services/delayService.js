/**
 * delayService.js — Dynamic per-leg delay detection for HerbTrace Digital Twin.
 *
 * Evaluates transit delay thresholds based on OSRM durations and block timestamps.
 */

const { getStageEvents } = require("./dbCache");
const { getRouteCache }  = require("./dbCache");
const { LEGS }           = require("./facilityRegistry");
require("dotenv").config();

const DELAY_BUFFER_FACTOR     = parseFloat(process.env.DELAY_BUFFER_FACTOR)     || 1.2;
const HANDLING_BUFFER_SECONDS = parseInt(process.env.HANDLING_BUFFER_SECONDS, 10) || 3600;

const STATUS_TO_EVENT = {
  Collected:   "BatchCreated",
  Tested:      "TestRecorded",
  Processed:   "BatchProcessed",
  Distributed: "CustodyTransferred",
};

function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function getAllowedSeconds(osrmDurationSeconds) {
  return Math.round(osrmDurationSeconds * DELAY_BUFFER_FACTOR + HANDLING_BUFFER_SECONDS);
}

function computeDelayLegs(batchId, nowTimestamp = null) {
  const stageEvents = getStageEvents(batchId);
  const now = nowTimestamp || Math.floor(Date.now() / 1000);

  const eventTimestamps = {};
  for (const ev of stageEvents) {
    if (!eventTimestamps[ev.eventName]) {
      eventTimestamps[ev.eventName] = ev.blockTimestamp;
    }
  }

  const results = [];

  for (const leg of LEGS) {
    const fromEvent = STATUS_TO_EVENT[leg.from];
    const toEvent   = STATUS_TO_EVENT[leg.to];

    if (!fromEvent) {
      results.push({
        legKey:                  leg.key,
        legLabel:                leg.label,
        fromStage:               leg.from,
        toStage:                 leg.to,
        osrmDurationSeconds:     null,
        osrmDurationFormatted:   "—",
        allowedSeconds:          null,
        allowedFormatted:        "—",
        elapsedSeconds:          null,
        elapsedFormatted:        "—",
        status:                  "Pending",
        isFallback:              false,
      });
      continue;
    }

    const routeData = getRouteCache(leg.key);
    const osrmDurationSeconds = routeData ? routeData.durationSeconds : null;
    const isFallback = routeData ? routeData.isFallback : false;
    const allowedSeconds = osrmDurationSeconds !== null
      ? getAllowedSeconds(osrmDurationSeconds)
      : null;

    const departureTs = eventTimestamps[fromEvent];
    const arrivalTs   = toEvent ? eventTimestamps[toEvent] : null;

    if (!departureTs) {
      results.push({
        legKey:                  leg.key,
        legLabel:                leg.label,
        fromStage:               leg.from,
        toStage:                 leg.to,
        osrmDurationSeconds,
        osrmDurationFormatted:   formatDuration(osrmDurationSeconds),
        allowedSeconds,
        allowedFormatted:        formatDuration(allowedSeconds),
        elapsedSeconds:          null,
        elapsedFormatted:        "—",
        status:                  "Pending",
        isFallback,
      });
      continue;
    }

    if (arrivalTs) {
      const elapsedSeconds = arrivalTs - departureTs;
      const status = allowedSeconds === null
        ? "On Time"
        : elapsedSeconds <= allowedSeconds ? "On Time" : "Late";

      results.push({
        legKey:                  leg.key,
        legLabel:                leg.label,
        fromStage:               leg.from,
        toStage:                 leg.to,
        osrmDurationSeconds,
        osrmDurationFormatted:   formatDuration(osrmDurationSeconds),
        allowedSeconds,
        allowedFormatted:        formatDuration(allowedSeconds),
        elapsedSeconds,
        elapsedFormatted:        formatDuration(elapsedSeconds),
        status,
        isFallback,
      });
    } else {
      const elapsedSeconds = now - departureTs;
      const status = allowedSeconds === null
        ? "In Transit"
        : elapsedSeconds > allowedSeconds ? "Delayed" : "In Transit";

      results.push({
        legKey:                  leg.key,
        legLabel:                leg.label,
        fromStage:               leg.from,
        toStage:                 leg.to,
        osrmDurationSeconds,
        osrmDurationFormatted:   formatDuration(osrmDurationSeconds),
        allowedSeconds,
        allowedFormatted:        formatDuration(allowedSeconds),
        elapsedSeconds,
        elapsedFormatted:        formatDuration(elapsedSeconds),
        status,
        isFallback,
      });
    }
  }

  return results;
}

function isDelayed(batchId, nowTimestamp = null) {
  const legs = computeDelayLegs(batchId, nowTimestamp);
  return legs.some((l) => l.status === "Delayed");
}

function formatLegsForEmission(legs) {
  return legs.map((leg) => ({
    key:                leg.legKey,
    label:              leg.legLabel,
    osrmExpected:       leg.osrmDurationFormatted,
    osrmSeconds:        leg.osrmDurationSeconds,
    allowedSeconds:     leg.allowedSeconds,
    allowed:            leg.allowedFormatted,
    elapsed:            leg.elapsedFormatted,
    elapsedSeconds:     leg.elapsedSeconds,
    status:             leg.status,
    isFallback:         leg.isFallback,
  }));
}

module.exports = {
  computeDelayLegs,
  isDelayed,
  formatLegsForEmission,
  formatDuration,
  getAllowedSeconds,
};
