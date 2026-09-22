const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash('password123', 10);
  await db.collection('users').updateMany({}, { $set: { password: hash } });
  console.log('Passwords updated to password123');
  process.exit(0);
});
