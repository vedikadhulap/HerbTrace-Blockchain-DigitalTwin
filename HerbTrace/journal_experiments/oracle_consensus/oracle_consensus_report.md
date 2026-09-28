# Multi-Oracle Consensus Experimental Evaluation

## 1. Methodology
This experiment evaluates the 4-oracle consensus mechanism implemented in `multiOracleService.js`.
The evaluation uses **synthetic (mocked) functional testing** to simulate 6 controlled scenarios, and separately measures **real API latency** for the free (no-key) oracles.
- The consensus logic applies the Haversine formula to compute distances.
- Configured threshold: **100 metres**.
- Requirement: At least 2 oracles must agree within the threshold for a `verified` status.

## 2. Synthetic Functional Testing Scenarios

### SCENARIO 1 — Strong agreement
- **Description:** All 4 oracles respond with coordinates very close to each other (<20m apart).
- **Expected Consensus:** `verified`
- **Actual Consensus:** `verified`
- **Verified Flag:** `true`
- **Result:** ✅ PASS
- **Successful Oracles:** 4
- **Agreement Pairs:** 6
- **Pairwise Distances (m):**
  - nominatim & bigdatacloud: 11m
  - nominatim & geocode.maps.co: 11m
  - nominatim & opencage: 15m
  - bigdatacloud & geocode.maps.co: 15m
  - bigdatacloud & opencage: 11m
  - geocode.maps.co & opencage: 11m

### SCENARIO 2 — Moderate agreement
- **Description:** 3 oracles agree, but 1 oracle is far outside the threshold (e.g. 50km away).
- **Expected Consensus:** `verified`
- **Actual Consensus:** `verified`
- **Verified Flag:** `true`
- **Result:** ✅ PASS
- **Successful Oracles:** 4
- **Agreement Pairs:** 3
- **Pairwise Distances (m):**
  - nominatim & bigdatacloud: 11m
  - nominatim & geocode.maps.co: 11m
  - bigdatacloud & geocode.maps.co: 15m

### SCENARIO 3 — Strong disagreement
- **Description:** All oracles return points that are >1km away from each other.
- **Expected Consensus:** `low_confidence`
- **Actual Consensus:** `low_confidence`
- **Verified Flag:** `false`
- **Result:** ✅ PASS
- **Successful Oracles:** 4
- **Agreement Pairs:** 0

### SCENARIO 4 — Missing/failing oracle
- **Description:** 1 oracle fails completely (network timeout). The remaining 3 agree.
- **Expected Consensus:** `verified`
- **Actual Consensus:** `verified`
- **Verified Flag:** `true`
- **Result:** ✅ PASS
- **Successful Oracles:** 3
- **Agreement Pairs:** 3
- **Pairwise Distances (m):**
  - bigdatacloud & geocode.maps.co: 11m
  - bigdatacloud & opencage: 11m
  - geocode.maps.co & opencage: 15m

### SCENARIO 5 — Multiple failures
- **Description:** 3 oracles fail, only 1 responds. Consensus cannot be reached.
- **Expected Consensus:** `no_data`
- **Actual Consensus:** `no_data`
- **Verified Flag:** `false`
- **Result:** ✅ PASS
- **Successful Oracles:** 1
- **Agreement Pairs:** 0

### SCENARIO 6 — Boundary condition
- **Description:** 2 oracles respond with points exactly 101 meters apart (just over 100m threshold).
- **Expected Consensus:** `low_confidence`
- **Actual Consensus:** `low_confidence`
- **Verified Flag:** `false`
- **Result:** ✅ PASS
- **Successful Oracles:** 2
- **Agreement Pairs:** 0

## 3. Real API Latency (Live Network Test)

The following latency was measured using actual API requests to the free/no-key providers.
*Note: Network conditions may vary.*

| Oracle | Latency (ms) | Success | Error (if any) |
|---|---|---|---|
| Nominatim | 1089 | true | - |
| BigDataCloud | 83 | true | - |
| Geocode.Maps.co | 395 | false | Request failed with status code 401 |

## 4. Evaluation Summary
- **A. Consensus Behavior:** The algorithm successfully verifies locations when at least 2 oracles agree within 100m, and correctly flags `low_confidence` when they disagree.
- **B. Failure Handling:** The system is fault-tolerant. It gracefully handles individual oracle failures as long as 2 valid responses exist. If fewer than 2 respond, it falls back to a safe `no_data` state.
- **C. Threshold Behavior:** The Haversine distance calculation correctly identifies locations just outside the 100m boundary (101m) as unverified.
- **D. Latency:** Real API latency varied, demonstrating the value of asynchronous parallel querying to prevent bottlenecks.
- **E. Limitations:** This evaluation does not measure real-world geocoding accuracy against absolute ground truth, but merely the mathematical consensus logic governing the oracle responses.

This report confirms the expected mathematical and state-machine behavior of the consensus model under synthetic conditions.
