const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const batchService = require("./services/batchService");
require("dotenv").config();

async function test() {
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  try {
    const data = { batchId: "TEST1", herbType: "Ashwagandha", farmerWallet: "0xC490620E2c7fFCdB4A640dec73da6551062f2Fb8", farmLocation: "Pune, Maharashtra", quantityKg: 100, latitude: 18.5204, longitude: 73.8567, userId: "tester" };
    const batch = await batchService.createBatch(data);
    console.log(batch);
  } catch(e) {
    console.error("FAIL:", e);
    console.error("FAIL MSG:", e.message);
  }
  process.exit(0);
}
test();
