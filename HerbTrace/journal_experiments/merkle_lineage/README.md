# Reproducibility Instructions: Merkle Lineage Tampering Experiment

This directory contains the experimental evaluation of the HerbTrace cross-stage Merkle lineage mechanism.

## Prerequisites
- Node.js
- Dependencies installed in the `herbtrace-contracts` and `herbtrace-backend` directories.

## How to Run
The experiment is implemented as a Hardhat script. To execute it:

1. Open a terminal.
2. Navigate to the `herbtrace-contracts` directory:
   ```bash
   cd path/to/HerbTrace/herbtrace-contracts
   ```
3. Run the script via Hardhat:
   ```bash
   npx hardhat run ../journal_experiments/merkle_lineage/experiment.js
   ```

## Outputs
- `merkle_lineage_results.json`: Machine-readable raw test output.
- `merkle_lineage_report.md`: Human-readable summary report.
