# HerbTrace Experiment 4: Lifecycle Latency Benchmark

This directory contains the completely redesigned and rigorous latency benchmark for the HerbTrace smart contract integration.

## Files Included

- `experiment.js`: The standalone benchmarking script. It executes end-to-end API lifecycle requests (`CREATE`, `LAB TEST`, `PROCESS`, `TRANSFER`) and uses non-invasive monkey patching to independently trace component latencies (MongoDB, Merkle, Oracle, Blockchain) without modifying production code.
- `latency_results_mock.json`: Raw results from 5 successful iterations of Mode A (Controlled Local Mode with mocked Oracle internet requests).
- `latency_results_real.json`: Raw results from 3 successful iterations of Mode B (Real External-Oracle Mode observing actual provider rate limits).
- `latency_report.md`: The exhaustive 19-section journal-ready analysis of the latency measurements.
- `METHODOLOGY_REVIEW.md`: The critical analysis discarding previous 404-based latency attempts.

## Execution Requirements

Run this benchmark from the backend root using:
```bash
node ../journal_experiments/latency/experiment.js
```
Use the `--mode=real` flag to enable live Oracle queries:
```bash
node ../journal_experiments/latency/experiment.js --mode=real
```

**Environment Requirements:**
A local Hardhat node must be running in a separate terminal:
```bash
npx hardhat node
```

*Note: This benchmark requires successful real blockchain interactions and expects valid contracts deployed to the local Hardhat instance.*
