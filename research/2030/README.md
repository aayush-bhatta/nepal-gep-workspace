# Nepal GEP — reproducible 2030 evidence-first model

**Model status: Completed, unverified source assumptions.** This is an illustrative national single-node least-cost capacity expansion linear program. It is **not** an officially endorsed Nepal 2030 construction programme.

## Notebook

[Nepal_GEP_2030_Complete_Evidence_First.ipynb](Nepal_GEP_2030_Complete_Evidence_First.ipynb)

[Run the notebook in Google Colab](https://colab.research.google.com/github/aayush-bhatta/nepal-gep-workspace/blob/main/research/2030/Nepal_GEP_2030_Complete_Evidence_First.ipynb)

The notebook has 42 cells, runs sequentially with SciPy HiGHS (not PuLP), and saves CSV and PNG outputs. Core inputs have embedded fallbacks. The external `nepal_jica_cost_lcoe_parameters.csv` and `nepal_jica_expansion_scenarios.csv` were **not mounted during our 2026-11-19 rerun**: embedded fallback values were used. Results must be recomputed when external evidence changes.

## Study scope

- Calendar 2030; representative-day LP: 12 monthly × 24-hour shapes = **288 independently optimized representative hours** weighted by actual days/month.
- Repeats the optimized representative daily shape within each month to reconstruct **8,760 dispatch rows**; this is *not* 8,760 independently optimized hours.
- One-node domestic grid with ROR, PROR, existing/new storage hydro, solar PV, imports, deterministic ENS.
- **No BESS**, no network OPF, no 2040 or 2050 optimization, no probabilistic outage/reliability calculation and no modeled exports.
- NEA FY2025/26 3,901.366 MW national hydro aggregate reconciled; 1,077.481 MW hydro classification remains unverified and is assigned ROR-like behavior **only for this scenario**; 904.600 MW provisional ROR-family links also need recheck.
- JICA middle-case 2030 consumer demand 24,737 GWh, loss assumption 13.9%, grid demand 28,730.546 GWh, peak 4,949 MW.
- 2040 JICA resource capacity factors used as 2030 hydrology proxies; 17% synthetic annual PV CF, 900-hour new reservoir energy capacity, six-hour PROR pondage, 750 MW import cap, 8% discount rate and 145 NPR/USD assumptions.
- Solar and storage capacity ceilings are binding in the LP; they do not represent verified construction schedules.

## Rerun summary — 2026-11-19

SciPy HiGHS: **Optimal**. 2,633 variables; 614 equality and 1,767 upper-bound constraints. All **12 notebook physical/accounting checks passed**.

| Technology | Existing MW (scenario) | New MW | Total MW |
|---|---:|---:|---:|
| ROR | 2,950.466 | 271.340 | 3,221.806 |
| PROR | 844.900 | 1,946.682 | 2,791.582 |
| Storage hydro | 106.000 | 675.400 | 781.400 |
| Solar PV | 154.940 | 2,027.760 | 2,182.700 |

Total installed 2030 **8,977.488 MW**, 2030 domestic production **27,189.937 GWh** and modeled imports **1,540.609 GWh**. Domestic demand supply 28,730.546 GWh, curtailment 929.207 GWh, deterministic unserved energy 0 GWh. Annualized model cost **NPR 149,273.96 million/year**.

The `results/` CSVs are derived directly from the successfully executed notebook and rounded only for display. To reconstruct all 15 full output files (including 288-hour and 8,760-hour dispatch), run the notebook; they are written to `GEP_2030_Outputs/` locally/Colab.

## Source trail and outstanding validation

1. [JICA / NEA, Integrated Power System Development Plan (December 2024)](https://openjicareport.jica.go.jp/pdf/12387999_01.pdf) and [Annexes](https://openjicareport.jica.go.jp/pdf/12387999_02.pdf) — demand forecasts, scenario portfolio and cost/reliability reference material.
2. [NEA, A Year in Review FY2025/26](https://www.nea.org.np/en/detail/annual-report-20252026) — the exact national aggregate and Kulekhani figures **as transcribed in the supplied notebook**. Source-page values still need an independent audit.
3. Source classifications and fixed cost benchmarks from user's previous GEP ledger/CSVs — **not primary-source verified** in this rerun.

Highest-priority remaining evidence: verify unclassified 1,077.481 MW hydro and provisional 904.600 MW IPP labels; current plant CODs; actual Nepal hourly hydro, demand and PV; tariff/FX/finance assumptions; reservoir feasibility and import/export capacities; probabilistic outages. Do not compare this directly with a JICA national portfolio without harmonizing horizon, data, model and objective.
