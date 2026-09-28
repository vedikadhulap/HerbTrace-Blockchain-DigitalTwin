const axios = require("axios");

async function checkTulsiApi() {
  try {
    const res = await axios.get("http://localhost:5000/batch/TULSI-1790105993038");
    console.log("✅ Batch API Data for TULSI-1790105993038:");
    console.log("  Batch ID:", res.data.batchId);
    console.log("  Status:", res.data.status);
    console.log("  txHash:", res.data.txHash);
    console.log("  Etherscan Link: https://sepolia.etherscan.io/tx/" + res.data.txHash);
  } catch (err) {
    console.error("API error:", err.message);
  }
}

checkTulsiApi();
