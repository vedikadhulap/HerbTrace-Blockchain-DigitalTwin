const axios = require("axios");

async function testCreateBatch() {
  const payload = {
    herbType: "Ashwagandha",
    herbVariety: "KSM-66",
    lotNumber: "FIELD-A9",
    harvestDate: "2026-09-28",
    quantityKg: 200,
    farmLocation: "Mumbai, Maharashtra",
    farmerWallet: "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8",
    latitude: 19.0171,
    longitude: 72.8553,
    batchId: `ASHWA-${Date.now()}`
  };

  console.log("Submitting batch to backend http://localhost:5000/batch ...");
  try {
    const res = await axios.post("http://localhost:5000/batch", payload);
    console.log("\n✅ Response Received!");
    console.log("Batch ID:", res.data.batchId);
    console.log("Transaction Hash:", res.data.txHash);
    console.log("Valid 0x hash?:", res.data.txHash && res.data.txHash.startsWith("0x"));
    console.log("Etherscan URL: https://sepolia.etherscan.io/tx/" + res.data.txHash);
  } catch (err) {
    console.error("Submission failed:", err.response?.data || err.message);
  }
}

testCreateBatch();
