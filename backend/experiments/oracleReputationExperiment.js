const { runExperiment } = require("../../herbtrace-backend/experiments/oracleReputationExperiment");

if (require.main === module) {
  runExperiment();
}

module.exports = { runExperiment };
