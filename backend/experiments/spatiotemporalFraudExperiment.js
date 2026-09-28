const { runFraudExperiment } = require("../../herbtrace-backend/experiments/spatiotemporalFraudExperiment");

if (require.main === module) {
  runFraudExperiment();
}

module.exports = { runFraudExperiment };
