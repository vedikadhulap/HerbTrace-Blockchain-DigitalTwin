const bcrypt = require("bcrypt");

const password = "admin1234"; // pick your own password here

bcrypt.hash(password, 10).then((hash) => {
  console.log(hash);
});