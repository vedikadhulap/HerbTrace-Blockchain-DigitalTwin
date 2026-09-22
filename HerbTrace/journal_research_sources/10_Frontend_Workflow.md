# 10. Frontend Workflow

The frontend is a React application utilizing Vite. It provides distinct interfaces based on the user's role.

## Main Pages & Components
- **`Home.jsx`:** Landing page displaying live stats (Batch Count, Recent Activity) by fetching from `/batch/count` and `/batch/recent`.
- **`Login.jsx` / `Signup.jsx`:** Authentication pages.
- **`Profile.jsx`:** User dashboard.
- **`Admin.jsx`:** Dashboard for users with `DEFAULT_ADMIN_ROLE` to manage users and view flagged verifications.
- **`Verify.jsx`:** A public tool to verify the authenticity of a batch by entering its `batchId`. It retrieves lineage, location consensus, and Merkle proofs.

## Role-Specific Workflows

### 1. Farmer (`CreateBatch.jsx`)
- Captures herb details (Type, Method, Weight, Lot Number).
- Utilizes `GPSBar.jsx` to automatically capture device coordinates.
- Can upload images (which go to IPFS).
- Submits form → Calls `POST /batch/create`.

### 2. Lab (`LabTest.jsx`)
- Enters `batchId`.
- Captures test results (Moisture, Purity, Heavy Metals).
- Utilizes `GPSBar.jsx`.
- Submits form → Calls `POST /batch/lab-test`.

### 3. Processor (`ProcessBatch.jsx`)
- Enters multiple parent `batchId`s to process.
- Enters new `batchId` for the resulting product.
- Captures processing notes and yield.
- Utilizes `GPSBar.jsx`.
- Submits form → Calls `POST /batch/process`.

### 4. Distributor (`TransferCustody.jsx`)
- Enters `batchId`.
- Enters `newOwner` (wallet address) and destination details.
- Utilizes `GPSBar.jsx`.
- Submits form → Calls `POST /batch/transfer`.

## Core Components
- **`GPSBar.jsx`:** Vital for the Location Oracle integration. Uses `navigator.geolocation.getCurrentPosition` to grab `latitude` and `longitude` before the user submits a stage form.
- **`ErrorCard.jsx` / `Toast.jsx`:** Standard UI feedback mechanisms.
- **`StatusPill.jsx`:** Renders colored badges based on batch status (CREATED, TESTED, PROCESSED, TRANSFERRED).

> [!NOTE]
> The Digital Twin functionality is not present in the current implementation scope as documented.
