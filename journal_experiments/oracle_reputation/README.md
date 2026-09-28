# HerbTrace Experiment 7 — Oracle Reputation Benchmark Directory

This directory contains the experimental setup, benchmark script, dataset output, and publication report for **Experiment 7: Reputation-Weighted Oracle Consensus under a Synthetic Outlier**.

## Directory Artifacts

- `oracle_reputation_experiment.js`: Standalone experiment execution script.
- `oracle_reputation_results.json`: Structured JSON containing raw round evaluations, EMA trajectories, consensus metrics, and metadata.
- `oracle_reputation_rounds.csv`: CSV file containing per-round oracle reputation trajectories over 20 simulation rounds.
- `oracle_reputation_report.md`: Paper-ready result section formatted for publication.
- `README.md`: Directory documentation and execution instructions.

## Reproduction Instructions

To execute Experiment 7:

```bash
node journal_experiments/oracle_reputation/oracle_reputation_experiment.js
```
