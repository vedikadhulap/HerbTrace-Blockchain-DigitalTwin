# Reproducibility Instructions: Multi-Oracle Consensus Experiment

This directory contains the experimental evaluation of the HerbTrace 4-oracle consensus mechanism.

## Prerequisites
- Node.js
- Dependencies installed in the `herbtrace-backend` directory.

## How to Run
The experiment is a standalone Node script that does not require Hardhat or a database.

1. Open a terminal.
2. Navigate to the `herbtrace-backend` directory:
   ```bash
   cd path/to/HerbTrace/herbtrace-backend
   ```
3. Run the script:
   ```bash
   node ../journal_experiments/oracle_consensus/experiment.js
   ```

## Outputs
- `oracle_consensus_results.json`: Machine-readable raw test output.
- `oracle_consensus_report.md`: Human-readable summary report.
