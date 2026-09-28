### Experiment 7 — Reputation-Weighted Oracle Consensus under a Synthetic Outlier

#### 7.1 Objective
The objective of Experiment 7 is to evaluate whether the reputation-weighted oracle consensus mechanism reduces the influence of a consistently misbehaving oracle while preserving geographic consensus accuracy. The experiment compares the baseline plain-majority consensus mechanism against the newly implemented reputation-weighted consensus scheme across 20 repeated simulation rounds under a controlled synthetic location outlier.

#### 7.2 Research Question
Does the Leave-One-Out (LOO) Exponential Moving Average (EMA) reputation weighting scheme systematically reduce the influence of a controlled synthetic outlier over repeated consensus rounds without degrading overall consensus accuracy?

#### 7.3 Experimental Setup
- **Evaluation Scope**: Production services (`multiOracleService.js`, `oracleReputationService.js`)
- **Environment**: Node.js runtime (`v22.14.0`)
- **Ground Truth Location**: Pune, Maharashtra (`18.5204, 73.8567`)
- **Oracle Fleet**: 4 Oracles (3 accurate + 1 controlled synthetic outlier)
- **Synthetic Outlier Shift**: Latitude shift to `(18.5249, 73.8567)`, resulting in a `500.38m` spatial deviation
- **Simulation Duration**: 20 independent consensus rounds
- **Reputation Parameters**: Initial Reputation $R_0 = 1.0$, EMA Weight $\alpha = 0.2$, Distance Threshold = $100\text{ m}$

#### 7.4 Baseline Majority Consensus
The baseline plain-majority consensus mechanism requires at least 2 oracles to return coordinates within a $100\text{ m}$ threshold. In this 4-oracle setup, the 3 accurate oracles form 3 agreeing pairs within $0\text{ m}$, satisfying the majority condition ($2\text{-of-}4$) in all rounds.

#### 7.5 Reputation-Weighted Consensus
The reputation-weighted mechanism clusters oracle responses within $100\text{ m}$ and sums member reputations to calculate cluster support. Leave-One-Out (LOO) evaluation determines agreement by comparing each oracle against the quorum of remaining oracles. Reputations update via an EMA formula:
$$R_{t} = \alpha \cdot a_t + (1 - \alpha) \cdot R_{t-1}$$
where $a_t \in \{0, 1\}$ represents LOO agreement in round $t$.

#### 7.6 Experimental Procedure
Table 7.1 outlines the oracle configuration evaluated over 20 simulation rounds.

**Table 7.1: Oracle Configuration for Synthetic Outlier Benchmark**

| Oracle Identity | Assigned Role | Spatial Behavior | Coordinates | Approx. Distance from Ground Truth |
|---|---|---|---|---:|
| `nominatim` | Accurate Oracle 1 | Accurate (Ground Truth) | `18.5204, 73.8567` | 0 m |
| `bigdatacloud` | Accurate Oracle 2 | Accurate (Ground Truth) | `18.5204, 73.8567` | 0 m |
| `geocode.maps.co` | Accurate Oracle 3 | Accurate (Ground Truth) | `18.5204, 73.8567` | 0 m |
| `opencage` | Injected Synthetic Outlier | Controlled Synthetic Outlier (~500m shift) | `18.5249, 73.8567` | 500.38 m |

#### 7.7 Results

##### Consensus Accuracy Comparison
Both the baseline plain-majority and reputation-weighted consensus mechanisms achieved identical $100\%$ consensus correctness across all 20 rounds, as detailed in Table 7.2.

**Table 7.2: Consensus Method Performance Comparison**

| Method | Total Rounds | Correct Rounds | Incorrect Rounds | Agreement Rate (%) |
|---|---:|---:|---:|---:|
| Plain Majority (2-of-4) | 20 | 20 | 0 | 100.0% |
| Reputation Weighted ($alpha=0.2$) | 20 | 20 | 0 | 100.0% |

##### Oracle Reputation Trajectories
Table 7.3 details the initial, final, and net change in reputation for all 4 evaluated oracles after 20 consensus rounds.

**Table 7.3: Oracle Reputation Evolution Summary**

| Oracle | Initial Reputation ($R_0$) | Final Reputation ($R_{20}$) | Absolute Change ($Delta R$) | Percentage Change (%) |
|---|---:|---:|---:|---:|
| `nominatim` | 1.0000 | 1.0000 | +0.0000 | +0.00% |
| `bigdatacloud` | 1.0000 | 1.0000 | +0.0000 | +0.00% |
| `geocode.maps.co` | 1.0000 | 1.0000 | +0.0000 | +0.00% |
| `opencage` | 1.0000 | 0.0116 | -0.9884 | -98.84% |

##### Round-by-Round Trajectory
Table 7.4 tracks the per-round reputation decay of the injected synthetic outlier (`opencage`) alongside consensus verification results.

**Table 7.4: Round-by-Round Synthetic Outlier Reputation Decay**

| Round | Plain Majority Result | Weighted Consensus Result | Synthetic Outlier (`opencage`) Reputation |
|---:|---|---|---:|
| 1 | PASS ✅ | PASS ✅ | 0.8000 |
| 2 | PASS ✅ | PASS ✅ | 0.6400 |
| 3 | PASS ✅ | PASS ✅ | 0.5120 |
| 4 | PASS ✅ | PASS ✅ | 0.4096 |
| 5 | PASS ✅ | PASS ✅ | 0.3277 |
| 6 | PASS ✅ | PASS ✅ | 0.2622 |
| 7 | PASS ✅ | PASS ✅ | 0.2098 |
| 8 | PASS ✅ | PASS ✅ | 0.1678 |
| 9 | PASS ✅ | PASS ✅ | 0.1342 |
| 10 | PASS ✅ | PASS ✅ | 0.1074 |
| 11 | PASS ✅ | PASS ✅ | 0.0859 |
| 12 | PASS ✅ | PASS ✅ | 0.0687 |
| 13 | PASS ✅ | PASS ✅ | 0.0550 |
| 14 | PASS ✅ | PASS ✅ | 0.0440 |
| 15 | PASS ✅ | PASS ✅ | 0.0352 |
| 16 | PASS ✅ | PASS ✅ | 0.0282 |
| 17 | PASS ✅ | PASS ✅ | 0.0226 |
| 18 | PASS ✅ | PASS ✅ | 0.0181 |
| 19 | PASS ✅ | PASS ✅ | 0.0145 |
| 20 | PASS ✅ | PASS ✅ | 0.0116 |

#### 7.8 Reputation Evolution Analysis
The 3 accurate oracles (`nominatim`, `bigdatacloud`, `geocode.maps.co`) maintained continuous agreement with the quorum ($a_t = 1$), preserving a constant reputation of $1.0000$ throughout the simulation. In contrast, the synthetic outlier (`opencage`), situated $500.38\text{ m}$ away, consistently failed LOO agreement ($a_t = 0$). Under the EMA update rule ($R_t = 0.8 \cdot R_{t-1}$), the outlier's reputation exponentially decayed from $1.0000$ to $0.0115$ over 20 rounds—representing a **$98.85\%$ reputation reduction**.

#### 7.9 Discussion
The primary contribution of reputation weighting observed in this experiment is **not** an increase in consensus correctness (as both plain majority and weighted consensus achieved $100\%$ accuracy due to the presence of 3 agreeing oracles), but rather the **progressive reduction of influence** assigned to a consistently misbehaving oracle. By down-weighting the outlier to $0.0115$, the system prevents a single faulty oracle from destabilizing consensus in subsequent edge-case scenarios where oracle availability may be degraded.

#### 7.10 Limitations
This benchmark evaluates oracle reputation dynamics under a controlled synthetic scenario involving one injected outlier and 20 simulation rounds. The results validate the mathematical convergence of the EMA model under constant spatial error but do not represent real-world API failure rates or dynamic network latencies.

#### 7.11 Reproducibility Instructions
To re-run the Experiment 7 benchmark and verify all reported numbers:
```bash
node journal_experiments/oracle_reputation/oracle_reputation_experiment.js
```
