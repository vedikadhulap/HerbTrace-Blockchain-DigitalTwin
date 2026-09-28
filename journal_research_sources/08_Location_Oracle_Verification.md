# 08. Location / Multi-Oracle Verification

## 1. Why Location Verification is Used
To cryptographically verify the geographical claims made by participants (Farmers, Labs, Processors, Distributors) and prevent location spoofing.

## 2. Location Data Sources
User devices supply raw GPS coordinates (latitude, longitude) via the HTML5 Geolocation API on the frontend.

## 3. GPS Capture Mechanism
Implemented in the `GPSBar.jsx` frontend component.

## 4. Oracle Sources
The backend uses multiple third-party geolocation APIs (Oracles) to reverse-geocode the coordinates:
1. Nominatim
2. BigDataCloud
3. Geocode.Maps.co
4. OpenCage

## 5. Number of Oracles
4 Oracles are configured.

## 6. How Oracle Results are Combined
The backend receives reverse-geocoded results (City, State, Country) and raw coordinates from the oracles.

## 7. Agreement/Consensus Logic
Pairs of oracle responses are compared. If the distance between the coordinates returned by the oracles is within a defined threshold, they are considered in "agreement".
- If sufficient agreement is reached, consensus = `verified`.
- If insufficient agreement, consensus = `low_confidence`.
- If no oracles respond, consensus = `no_data`.

## 8. Tolerance/Radius Logic
Implemented using a `thresholdM` (metres) field in the `LocationVerification` schema, defaulting to 100 meters.

## 9. Disagreement
Documents with `consensus="low_confidence"` trigger a `needsAdminReview = true` flag in the MongoDB schema for manual review by an admin.

## 10. Data Stored
- Raw coordinates (`latitude`, `longitude`)
- Typed location (`typedLocation`)
- Individual oracle results (`oracleResults`)
- Final verdict (`consensus`, `verified`, `agreedLocation`)

## 11. Storage Location
- **Off-chain:** Detailed consensus data stored in MongoDB (`LocationVerification.js`).
- **On-chain:** The final verification status and agreed location string are anchored via `recordLocationVerification` on the smart contract.

## 12. Relevant Backend Services
- `oracleService.js` (inferred from schema)
- `batchService.js` (invokes location verification during batch lifecycle events).

## 13. Relevant API Endpoints
- `GET /batch/:batchId/location-verification` -> Retrieves location verification data for a batch.

## 14. Relevant Smart-Contract Functions
- `recordLocationVerification(string memory batchId, uint256 stageIndex, bool verified, string memory location)`

## 15. Relevant Database Models
- `LocationVerification.js`: Contains `oracleResultSchema`, `agreementPairSchema`, and consensus flags.

## Summary of Distinctions
- **Raw coordinates:** Numeric Lat/Lon supplied by the browser.
- **Human-readable location:** The `typedLocation` supplied manually by the user, and the reverse-geocoded strings (City, State) from the oracles.
- **Verified/agreed location:** The `agreedLocation` derived from oracle consensus.
