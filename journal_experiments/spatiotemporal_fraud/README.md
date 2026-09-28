# HerbTrace Experiment 8 — Spatiotemporal Fraud Detection Directory

This directory contains the experimental setup, standalone research harness, dataset output, and publication report for **Experiment 8: Spatiotemporal Fraud Detection Benchmark**.

## Directory Artifacts

- `spatiotemporal_fraud_experiment.js`: Standalone experiment execution script.
- `spatiotemporal_fraud_results.json`: Structured JSON containing raw scenario evaluations, Haversine displacement calculations, implied speeds, detection metrics, and schema documentation.
- `spatiotemporal_fraud_scenarios.csv`: CSV dataset containing all 16 evaluated scenarios.
- `spatiotemporal_fraud_report.md`: Paper-ready result section formatted for publication.
- `README.md`: Directory documentation and execution instructions.

## Production Data Fields Discovered

- **CREATE Stage**: `batch.location` (`latitude`, `longitude`), `batch.harvestDate` / `batch.createdAt`
- **LAB TEST Stage**: `batch.labLocation` (`latitude`, `longitude`), `batch.labData.testedAt` / `batch.updatedAt`
- **PROCESS Stage**: `batch.processLocation` (`latitude`, `longitude`), `batch.processorData.processedAt` / `batch.updatedAt`
- **TRANSFER Stage**: `batch.transferLocation` (`latitude`, `longitude`), `batch.transferData.transferredAt` / `batch.updatedAt`

## Reproduction Instructions

To execute Experiment 8:

```bash
node journal_experiments/spatiotemporal_fraud/spatiotemporal_fraud_experiment.js
```
