# Nepal GEP 2030 — Model formulation, data construction and evidence ledger

**Status:** one reproducible illustrative 2030 linear-programming run, not a verified national investment plan.

**Primary executable source:** [42-cell evidence-first notebook](Nepal_GEP_2030_Complete_Evidence_First.ipynb), Steps A–R. The values below follow that exact notebook and its supplied planning-cost fallback values. They are **not** newly measured river inflows, solar irradiance or 2030 chronological demand.

## A. What is an input and what is a result?

| Layer | Quantity | Interpretation |
|---|---|---|
| Published forecast, JICA IPSDP 2024 | Consumer electricity 24,737 GWh in 2030; sending-end peak 4,949 MW | Source forecast, not 2030 observation |
| Scenario conversion | 13.9% system-loss fraction → grid energy 28,730.546 GWh | Notebook scenario / source-based loss factor |
| Historic NEA capacity ledger | 3,901.366 MW hydro and 154.940 MW solar | Values **as transcribed in the notebook** from FY2025/26; plant-type split needs independent audit |
| Explicit technology allocation for model | 2,950.466 MW ROR, 844.900 MW PROR, 106 MW Kulekhani cascade, 154.940 MW solar | Modelled 2026 base, **not** independently verified official ROR/PROR classification |
| LP investment decisions | New capacity by 2030, 271.340 / 1,946.682 / 675.400 / 2,027.760 MW for ROR / PROR / storage / PV | Calculated by SciPy HiGHS given assumptions |
| Derived result | Total installed 2030 = 8,977.488 MW | Baseline 4,056.306 MW + modelled new 4,921.182 MW |

The unknown hydro allocation comprises **1,077.481 MW** assigned ROR-like behavior (100% of the unclassified balance) in this base case. Within the recorded ROR-family entry, **904.600 MW** of plant/project links remain provisional. These are the largest unresolved source classifications. Existing Kulekhani I–III is represented as a **106 MW shared-water cascade**.

## B. Demand

JICA *Project on Integrated Power System Development Plan in Nepal, Final Report* (December 2024), middle-case demand forecast, provides 24,737 GWh consumer demand and 4,949 MW peak in 2030.

`E_grid = E_consumer/(1 - loss) = 24737/(1 - 0.139) = 28730.5458769 GWh.`

A 24-element load-shape template from earlier Colab Step 37 is normalized to the grid-energy mean and the 4,949 MW peak:

`D_h = D_mean + (D_peak - D_mean)(s_h - mean(s))/(max(s)-mean(s))`

`D_mean = (E_grid × 1000 MWh/GWh) / 8760 h.`

Each day of each month uses the same 24-hour shape. The 8,760 rows do **not** contain stochastic or weather-driven day-to-day variation. Monthly demand is proportional to the number of calendar days.

## C. ROR availability and PROR inflow — different physical meanings

JICA IPSDP, §4.4, planned **DoED project list**: ROR 14,869 MW / 83,633 GWh, PROR 12,831 MW / 63,494 GWh, storage 12,370 MW / 41,638 GWh. These figures form **planning-yield proxies** for a 2030 illustration. They do not establish 2026 nationwide technology-specific measured capacity factors.

`CF_ROR = (83633 × 1000)/(14869 × 8760) = 0.642083941`

`CF_PROR = (63494 × 1000)/(12831 × 8760) = 0.564895450`

Monthly seasonality ratios:

ROR: `[0.400, 0.300, 0.400, 0.600, 0.800, 1, 1, 1, 1, 0.83333, 0.66667, 0.500]`.

PROR: `[0.400, 0.304, 0.400, 0.600, 0.800, 1, 1, 1, 1, 0.83333, 0.66667, 0.500]`.

`mean_days(r) = Σ_m days_m × r_m / 365`

`a_ROR_m = CF_ROR × r_ROR,m / mean_days(r_ROR)`

`b_PROR_m = CF_PROR × r_PROR,m / mean_days(r_PROR)`.

For ROR, `a_ROR_m` limits maximum **hourly electricity generation MW per installed MW**, i.e., `p_ROR_mh ≤ a_ROR_m (K_ROR + x_ROR)`.

For PROR, `b_PROR_m` represents water **energy entering the pond per hour and MW installed**; PROR dispatch is instead limited by its turbines and pondage balance. Do not interpret PROR b as a strict hourly output limit. The model's 6-hour pondage volume and daily cyclic boundary are assumptions.

**Worked February example:** `a_ROR_Feb ≈ 0.27111`, `b_PROR_Feb ≈ 0.24160`. For August, `a_ROR_Aug ≈ 0.90370`, `b_PROR_Aug ≈ 0.79472`.

## D. Existing versus candidate storage hydro

For Kulekhani I–III (106 MW), NEA FY2025/26 historical generation is transcribed as a summed **92,362.28 MWh** over the fiscal year; the notebook maps monthly Nepali periods approximately to calendar months. These are **generation volumes**, **not inflow measurements**.

`p_oldSTO_mh ≤ 106 MW;quad days_m × Σ_h p_oldSTO_mh ≤ E_historical_Kulekhani,m`.

For **new reservoir hydro**, JICA project portfolio gives the analogous yield proxy:

`CF_STO = (41638 × 1000)/(12370 × 8760) ≈ 0.384251928`.

The candidate monthly energy inflow proxy in MWh per new MW is:

`W_m = CF_STO × 8760 × r_ROR,m × days_m / Σ_j (r_ROR,j × days_j)`.

A synthetic seasonal reservoir stores `0 ≤ R_m ≤ 900 × x_STO` MWh. It starts at 50% and returns to the same annual inventory to prevent free water. `900 MWh/MW` is an **illustrative duration**, not a claim about a named Nepal storage project.

## E. Solar PV

The planning PV CF is **0.17**, not measured national hourly output. The model assumes daylight from 06:00 to 18:00:

`s_h = max(0, sin[π(h-6)/12])`.

Month weights `[0.90,1.02,1.12,1.13,1.05,0.88,0.72,0.75,0.86,1.00,1.06,1.00]` are synthetic cloudiness factors.

`a_PV,mh = scale × weight_m × s_h`, calibrated such that `Σ_m days_m Σ_h a_PV,mh / 8760 = 0.17`. Solar dispatch is bounded by `p_PV,mh ≤ a_PV,mh (K_PV + x_PV)`.

## F. Cost coefficients and bounds

Technology costs from the notebook's embedded version of the supplied `nepal_jica_cost_lcoe_parameters.csv` are benchmark assumptions, **not directly verified PPA tariffs**:

| Technology | CAPEX USD/kW | Fixed O&M USD/kW-year | Variable O&M USD/MWh | Life, years |
|---|---:|---:|---:|---:|
| ROR | 1,650 | 35 | 1.5 | 40 |
| PROR | 1,850 | 40 | 2.0 | 45 |
| Storage hydro | 2,500 | 50 | 2.5 | 50 |
| Solar PV | 691 | 12 | 0 | 25 |

Assumed exchange rate `145 NPR/USD`; discount rate `r=0.08`. Capital recovery factor:

`CRF(r,n) = r(1+r)^n / ((1+r)^n - 1)`.

CAPEX in NPR million per MW-year: `CAPEX_USD/kW × 1000 kW/MW × 145 NPR/USD × CRF / 10^6`.

Annualised CAPEX is applied to **new** capacity only; fixed O&M includes existing **and** new capacity. Imports use a historical implied average price `10560 million NPR / 1171 GWh = 9.01793 NPR/kWh`, not an assured 2030 tariff. Unserved energy uses historical VOLL proxy `0.76 USD/kWh × 145 = 110.2 NPR/kWh`. A PPA tariff must not be added again on top of CAPEX, as that would generally double-count investment recovery.

The modeled new-build upper bounds (MW) are **screening constraints** from the scenario portfolio totals, less assumed existing MW:

| Tech | 2030 portfolio total MW | 2026 model MW | Upper bound on new MW |
|---|---:|---:|---:|
| ROR | 7,843.7 | 2,950.466 | 4,893.234 |
| PROR | 3,711.6 | 844.9 | 2,866.7 |
| Storage | 781.4 | 106 | 675.4 |
| Solar | 2,182.7 | 154.94 | 2,027.76 |

These ceilings are not verified 2030 project CODs, land/site suitability or PPA availability. Solar and storage new-build ceilings bind in the current solution.

## G. Least-cost LP

Sets `g` technology, `m` month, `h=0..23` representative hour; `d_m` actual days in month.

Variables: `x_g ≥ 0` new MW; `p_g,mh ≥ 0` dispatch MW; `i_mh ≥ 0` imported MW; `u_mh ≥ 0` unserved MW; `S_mh` PROR pondage MWh, `R_m` candidate seasonal reservoir MWh, `w_mh` PROR spill and `z_m` new reservoir spill.

Objective in NPR million/year:

`min Z = Σ_g[CRF_g × CAPEX_g × x_g + FOM_g × (K_g + x_g)] + Σ_mΣ_h d_m[Σ_g VOM_g × p_g,mh + c_I × i_mh + VOLL × u_mh]`.

All cost units must be harmonised. The existing fixed O&M term is a constant and is added after solving to the reported annual objective.

Subject to:

1. `Σ_g p_g,mh + i_mh + u_mh = D_mh` for each of 288 represented hours.
2. ROR and PV resource availability as shown above.
3. `p_PROR,mh ≤ K_PROR + x_PROR`, hourly `S_(h+1) = S_h + b_PROR,m(K_PROR+x_PROR) − p_PROR,mh − w_mh`, `0≤S_h≤6(K_PROR+x_PROR)`, daily cyclic boundary with half-full start.
4. Existing storage power cap 106 MW and historical Kulekhani monthly energy budget.
5. Candidate seasonal hydro power `p_newSTO,mh≤x_STO`; `R_(m+1)=R_m+W_m×x_STO−d_mΣ_h p_newSTO,mh−z_m`; `0≤R_m≤900x_STO`; annual cyclic boundary.
6. `i_mh≤750 MW` import cap.
7. `Σ_mΣ_h d_m u_mh ≤ 0.0001×E_grid_MWh` deterministic ENS budget. This is not EENS from a probability distribution.
8. February dry-evening firm-capacity proxy `a_ROR,Feb(K_ROR+x_ROR)+(K_PROR+x_PROR)+106+x_STO+750 ≥ 1.05 × 4949 MW`; solar gets no firm credit. The assumption of full firm hydro and imports is not independently validated.
9. `0≤x_g≤x_g,max` capacity screens.

`p_ROR` and `p_PV` can be curtailed (availability minus dispatched generation). PROR pondage and reservoir spillage are explicit variables. Exports, network power flow, BESS and unit commitment are absent.

There are 2,633 LP variables, 614 equality rows and 1,767 upper-bound rows. SciPy `linprog(method='highs')` reports optimal. The exact set of 288 monthly representative hours is expanded into 8,760 **repeated** hourly rows; it does not create 8,760 independently optimised states.

## H. What needs to be verified next?

- Independently recheck NEA FY2025/26 hydro/solar capacity and Kulekhani station-generation tables, plant categories and calendar mapping.
- Resolve 1,077.481 MW unclassified hydro and 904.600 MW provisional ROR-family links.
- Replace fixed monthly hydrology and PV coefficients with multi-year, multi-site measurements and explicit uncertainty.
- Verify site-specific head/inflow/reservoir capacity, licensing, environmental feasibility and COD for new hydro.
- Validate cost benchmarks and 2030 import/export prices and limits.
- Add BESS, network flows and chronological variation when evidence permits.
- Run sensitivity cases before interpreting a least-cost technology decision.

## References (source trail)

1. JICA, *Project on Integrated Power System Development Plan in Nepal — Final Report*, Dec. 2024. [Final report, volume 1](https://openjicareport.jica.go.jp/pdf/12387999_01.pdf), middle-case demand table; §4.4 DoED planned project portfolio; 2030 scenario capacity figures.
2. JICA, *Final Report Annexes*. [Volume 2](https://openjicareport.jica.go.jp/pdf/12387999_02.pdf); [Solar resource discussion](https://openjicareport.jica.go.jp/pdf/12387999_03.pdf). This model borrows planning proxies, not measured national hourly data.
3. NEA, *A Year in Review, FY2025/26*. [NEA annual reports archive](https://www.nea.org.np/en/category/annual-reports). Hydro and solar totals and Kulekhani generation are **as transcribed in the supplied notebook** and remain flagged for independent verification.
4. User's original `Nepal_GEP_2030_Complete_Evidence_First.ipynb`, Steps A–R, stored alongside this document.

The report and live site keep source-supplied values separate from assumptions, computations and LP results.
