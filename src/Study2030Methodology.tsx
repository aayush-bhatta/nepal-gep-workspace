import React from 'react';
import {Download,ExternalLink} from 'lucide-react';
import {csv,downloadBlob} from './db';

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS=[31,28,31,30,31,30,31,31,30,31,30,31];
const ROR_RATIO=[.4,.3,.4,.6,.8,1,1,1,1,5/6,2/3,.5];
const PROR_RATIO=[.4,.304,.4,.6,.8,1,1,1,1,5/6,2/3,.5];
const PV_MONTH=[.90,1.02,1.12,1.13,1.05,.88,.72,.75,.86,1,1.06,1];
const HIST_STORAGE=[1943.43,1446.25,2914.85,5124.24,31370.40,19079.15,10024.79,13773.60,4177.10,726.80,860.90,920.77];
export const ROR_CF=(83633*1000)/(14869*8760);
export const PROR_CF=(63494*1000)/(12831*8760);
export const STORAGE_CF=(41638*1000)/(12370*8760);
const weightedMean=(v:number[])=>v.reduce((sum,n,i)=>sum+n*DAYS[i],0)/365;
const meanRor=weightedMean(ROR_RATIO),meanPror=weightedMean(PROR_RATIO);
const solarDay=Array.from({length:24},(_,h)=>Math.max(0,Math.sin(Math.PI*(h-6)/12)));
const solarMean=solarDay.reduce((a,b)=>a+b,0)/24;
const solarScale=.17/(weightedMean(PV_MONTH)*solarMean);
export const monthlyCalibration2030=MONTHS.map((month,i)=>({
 month,days:DAYS[i],
 ror_ratio:ROR_RATIO[i],
 pror_ratio:PROR_RATIO[i],
 ror_avail:ROR_CF*ROR_RATIO[i]/meanRor,
 pror_inflow:PROR_CF*PROR_RATIO[i]/meanPror,
 solar_mean:solarScale*PV_MONTH[i]*solarMean,
 existing_storage_mwh:HIST_STORAGE[i],
 new_storage_mwh_per_mw:STORAGE_CF*8760*ROR_RATIO[i]*DAYS[i]/
     ROR_RATIO.reduce((a,b,j)=>a+b*DAYS[j],0),
 demand_gwh:28730.5458769*DAYS[i]/365
}));
const format=(n:number,dec=3)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(n);
const links={
 jica:'https://openjicareport.jica.go.jp/pdf/12387999_01.pdf',
 jicaAnnex:'https://openjicareport.jica.go.jp/pdf/12387999_02.pdf',
 jicaSolar:'https://openjicareport.jica.go.jp/pdf/12387999_03.pdf',
 nea:'https://www.nea.org.np/en/category/annual-reports'
};

const inputs=[
 {item:'2030 annual demand',value:'24,737 GWh (at consumer meter)',basis:'JICA middle-case forecast',method:'Divide by (1 − 0.139) for modelled grid requirement, then scale a repeated 24-hour shape to both annual energy and peak.'},
 {item:'Existing generation',value:'3,901.366 MW hydro + 154.940 MW PV',basis:'NEA FY2025/26 totals as transcribed in notebook',method:'Reconcile plant ledger. Assign the still-unclassified 1,077.481 MW to ROR-like operation in this baseline scenario only.'},
 {item:'ROR availability',value:'0.64208 annual CF proxy',basis:'Calculated from JICA DoED planned project list',method:'83,633 GWh ÷ (14,869 MW × 8,760 h); distribute by illustrative wet/dry monthly weights.'},
 {item:'PROR river inflow',value:'0.56490 annual inflow proxy',basis:'Calculated from JICA DoED planned project list',method:'63,494 GWh ÷ (12,831 MW × 8,760 h); convert to monthly water-inflow coefficients, then allow daily pondage.'},
 {item:'Existing reservoir hydro',value:'106 MW; 92,362.28 MWh historical year',basis:'Kulekhani station generation transcribed from NEA',method:'Use monthly generation as upper energy budgets, approximately aligned to Gregorian months. These are not measured inflows.'},
 {item:'Candidate reservoir hydro',value:'0.38425 annual CF proxy; 900 MWh/MW inventory',basis:'JICA planned projects + assumed storage duration',method:'41,638 GWh ÷ (12,370 MW × 8,760 h), allocated to synthetic monthly water volumes; 900 MWh/MW caps stored energy.'},
 {item:'Solar PV resource',value:'17.0% target annual CF',basis:'Planning benchmark + synthetic solar shape',method:'A daylight sine curve (06:00–18:00), seasonal cloud-weight assumptions and one scale factor reconstruct the 17% annual CF.'},
 {item:'Technology costs',value:'4 technology benchmark rows',basis:'Embedded supplied cost table, not certified procurement',method:'Convert CAPEX and O&M from USD with assumed NPR 145/USD; annualise new investment with 8% discount rate and each asset life.'}
];
const constraints=[
 {name:'Capacity investment',symbol:'0 ≤ x_g ≤ x̄_g',meaning:'New MW are decisions. Each upper bound is the JICA-like 2030 scenario portfolio screen minus the modelled 2026 capacity, not verified shovel-ready sites.'},
 {name:'Supply balance — every representative hour',symbol:'p_ROR + p_PROR + p_oldSTO + p_newSTO + p_PV + i + u = D',meaning:'The seven components must add exactly to demand (MW). No electricity exports or network congestion are represented.'},
 {name:'ROR river availability',symbol:'p_ROR(m,h) ≤ [K_ROR + x_ROR] × a_ROR(m)',meaning:'ROR cannot dispatch more than the seasonally available river power. Unused available ROR output is implicitly curtailed.'},
 {name:'Solar resource',symbol:'p_PV(m,h) ≤ [K_PV + x_PV] × a_PV(m,h)',meaning:'Hourly PV upper bound follows the synthetic daylight-and-cloudiness curve. PV can be curtailed.'},
 {name:'PROR power and short-term water',symbol:'p_PROR(m,h) ≤ K_PROR + x_PROR; S(h+1) = S(h) + b_PROR(m) × [K_PROR + x_PROR] − p_PROR(m,h) − spill(m,h)',meaning:'PROR has installed MW plus a cyclic daily pondage balance. Pondage is capped at 6 MWh per MW, starts half full, and returns to its initial level after 24 hours.'},
 {name:'Existing Kulekhani chain',symbol:'p_oldSTO(m,h) ≤ 106 MW; d_m × Σ_h p_oldSTO(m,h) ≤ E_NEA(m)',meaning:'The 106 MW cascade shares one historical monthly energy budget (MWh), preventing the same river water from being credited separately at all cascade stations.'},
 {name:'New seasonal reservoir',symbol:'p_newSTO(m,h) ≤ x_STO; R(m+1) = R(m) + W(m) × x_STO − d_m × Σ_h p_newSTO(m,h) − spill(m)',meaning:'Reservoir energy (MWh) is limited to 900 × new storage MW, starts 50% full and finishes the year at the same inventory. W(m) is a synthetic monthly MWh/MW inflow, not measured river flow.'},
 {name:'Imports and unmet load',symbol:'0 ≤ i(m,h) ≤ 750 MW; Σ_(m,h) d_m × u(m,h) ≤ 0.0001 × E_grid (MWh)',meaning:'750 MW import ceiling and 0.01% annual unserved-energy limit are assumptions. ENS is a deterministic slack variable; no stochastic outage model or probabilistic EENS/LOLE is included.'},
 {name:'Dry-peak adequacy screen',symbol:'a_ROR(Feb) × [K_ROR+x_ROR] + [K_PROR+x_PROR] + 106 + x_STO + 750 ≥ 1.05 × 4,949 MW',meaning:'Illustrative 5% evening-peak screen, assuming PROR, hydro storage and maximum imports are fully firm. PV is not credited. This does not replace a probabilistic adequacy study.'}
];
export function Study2030Methodology(){
 function exportMonthly(){
  const rows=monthlyCalibration2030.map(m=>({
   Month:m.month,Days:m.days,Demand_GWh:m.demand_gwh,
   ROR_Season_Ratio:m.ror_ratio,PROR_Season_Ratio:m.pror_ratio,
   ROR_Availability_MW_per_MW:m.ror_avail,
   PROR_Water_Inflow_MWh_per_MW_hour:m.pror_inflow,
   Solar_Mean_Availability_MW_per_MW:m.solar_mean,
   Existing_Kulekhani_Generation_MWh:m.existing_storage_mwh,
   New_Storage_Seasonal_Inflow_MWh_per_New_MW:m.new_storage_mwh_per_mw
  }));
  downloadBlob(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),'2030_monthly_source_to_model_coefficients.csv');
 }
 return <div className="study-detailed">
  <section className="card study-panel" id="study-evidence">
    <div className="study-section-heading"><span className="study-section-num">01</span><div>
      <h2>From source documents to model inputs</h2>
      <p>Not every number in the optimisation was measured. The notebook combines published forecasts, past station records, calculated planning coefficients, and synthetic operating assumptions. Those four types must be distinguished when interpreting the result.</p>
    </div></div>
    <div className="study-source-steps"><span>Published forecast or historical record</span><span>Calculation / modelling assumption</span><span>Hourly or monthly constraint</span><span>Optimised outcome</span></div>
    <div className="tablewrap"><table className="study-provenance-table">
      <thead><tr><th>Model input</th><th>Number used</th><th>Evidence classification</th><th>How it enters the model</th></tr></thead>
      <tbody>{inputs.map(x=><tr key={x.item}><th scope="row">{x.item}</th><td>{x.value}</td><td>{x.basis}</td><td>{x.method}</td></tr>)}</tbody>
    </table></div>
    <p className="study-source-note">Source guide: <a href={links.jica} target="_blank" rel="noopener noreferrer">JICA IPSDP 2024, middle-case demand and §4.4 planned hydropower table <ExternalLink size={12}/></a> · <a href={links.nea} target="_blank" rel="noopener noreferrer">NEA FY2025/26 annual report, capacity and generation appendices <ExternalLink size={12}/></a>. The NEA station and capacity figures above follow the notebook's transcription and still need an independent table-level audit.</p>
  </section>
  <section className="card study-panel" id="study-calibration">
    <div className="study-section-heading"><span className="study-section-num">02</span><div>
      <h2>Hydrology and solar: coefficients, not observed time series</h2>
      <p>ROR, PROR and new storage use capacity-factor-like planning proxies derived from JICA's proposed project portfolio. A seasonal curve is then imposed on them. Solar uses an assumed 17% annual capacity factor and a normalized daylight shape.</p>
    </div></div>
    <div className="study-equation-grid">
      <div><b>ROR annual capacity-factor proxy</b><code>CF_ROR = (83,633 GWh × 1,000) / (14,869 MW × 8,760 h) = {format(ROR_CF,5)}</code><p>JICA's planned-project energy divided by planned capacity-hours. This is not Nepal's measured 2026 ROR CF.</p></div>
      <div><b>PROR water-inflow coefficient</b><code>CF_PROR = (63,494 GWh × 1,000) / (12,831 MW × 8,760 h) = {format(PROR_CF,5)}</code><p>The annual proxy is distributed into hourly inflow, then limited by a six-hour daily pondage balance. It is not an hourly PROR generation ceiling.</p></div>
      <div><b>Monthly wet/dry calibration</b><code>a_ROR(m) = CF_ROR × r_ROR(m) / mean_days(r_ROR)</code><code>b_PROR(m) = CF_PROR × r_PROR(m) / mean_days(r_PROR)</code><p>Each monthly ratio r is synthetic. The denominator uses calendar-day weights (31, 28, …), preserving the intended annual average.</p></div>
      <div><b>New storage inflow proxy</b><code>CF_STO = (41,638 × 1,000) / (12,370 × 8,760) = {format(STORAGE_CF,5)}</code><code>W(m) = CF_STO × 8,760 × r_ROR(m) × days(m) / Σ_j[r_ROR(j) × days(j)]</code><p>W is MWh of monthly potential inflow per MW of new storage. The separate 900 MWh/MW reservoir inventory is an assumed energy-storage volume.</p></div>
      <div><b>Solar PV hourly availability</b><code>s(h) = max[0, sin(π × (h − 6) / 12)]</code><code>a_PV(m,h) = scale × cloud_weight(m) × s(h)</code><p>The scale is selected so the calendar-weighted average of all 12×24 coefficients equals 0.17. This produces no solar generation at night.</p></div>
      <div><b>Demand: forecast to hourly MW</b><code>E_grid = 24,737 / (1 − 0.139) = 28,730.546 GWh/year</code><code>D(h) = D_mean + (4,949 − D_mean) × [shape(h) − mean(shape)] / [max(shape) − mean(shape)]</code><p>The same 24-hour demand shape is repeated daily. Energy and 4,949 MW peak are preserved, but real day-to-day demand variability is absent.</p></div>
    </div>
    <div className="study-heading"><h3>Monthly operating coefficients used by the solver</h3><button onClick={exportMonthly}><Download size={15}/> Download calibration CSV</button></div>
    <p className="muted">In the table below, “ROR factor” is available MW per MW installed; “PROR inflow” is potential MWh entering pondage per MW installed, per hour. “Solar factor” is the month's mean hourly available MW per MW PV—not the midday peak.</p>
    <div className="tablewrap"><table className="study-coeff-table"><thead><tr><th>Month</th><th>ROR ratio</th><th>ROR factor</th><th>PROR ratio</th><th>PROR inflow</th><th>Solar mean</th><th>Kulekhani historic MWh</th><th>New storage MWh/MW</th></tr></thead>
    <tbody>{monthlyCalibration2030.map(m=><tr key={m.month}><th scope="row">{m.month}</th><td>{format(m.ror_ratio,3)}</td><td>{format(m.ror_avail,3)}</td><td>{format(m.pror_ratio,3)}</td><td>{format(m.pror_inflow,3)}</td><td>{format(m.solar_mean,3)}</td><td>{format(m.existing_storage_mwh,2)}</td><td>{format(m.new_storage_mwh_per_mw,2)}</td></tr>)}</tbody></table></div>
    <p className="study-footnote">Example: February ROR availability is {format(monthly[1].ror_avail,4)} MW per installed MW versus August {format(monthly[7].ror_avail,4)}. The apparent precision comes from numerical calibration—not measurement accuracy. For Kulekhani, NEA's fiscal-year months are approximately remapped to calendar months; figures are historical generation budgets, not measured inflows.</p>
  </section>
  <section className="card study-panel" id="study-optimization">
    <div className="study-section-heading"><span className="study-section-num">03</span><div><h2>Least-cost generation expansion: what was optimised</h2>
      <p>The model chooses new installed MW and the operating pattern needed to serve Nepal's forecast domestic grid demand at minimum modeled annual cost. Its electricity balance is hourly within each representative day; the water budgets connect PROR hours and storage months.</p></div></div>
    <div className="study-notation"><b>Index and decisions</b><p>g = generation technology; m = month; h = hour of the representative day; dₘ = number of days in month m. K<sub>g</sub> is existing 2026 MW, x<sub>g</sub> is new MW, p<sub>g,m,h</sub> is dispatched MW. Import i and unserved demand u are in MW; pondage S and reservoir R are in MWh.</p></div>
    <div className="study-objective"><b>Objective — annual system cost in NPR million/year</b>
      <code>min Z = Σ_g [annualised_CAPEX_g × x_g + FOM_g × (K_g + x_g)] + Σ_(m,h) days(m) × [Σ_g VOM_g × p_g,m,h + import_price × i_m,h + VOLL × u_m,h]</code>
      <p>Capital recovery factor: CRF = r(1+r)ⁿ / [(1+r)ⁿ − 1]. Here r = 8% and n is technology lifetime. The solver excludes the constant fixed O&M of already installed plants from its changing decision coefficients, then adds that constant back into the reported total annual cost. All terms are converted to NPR million.</p>
    </div>
    <h3>Constraint set implemented in the notebook</h3>
    <div className="study-constraints">{constraints.map((x,i)=><article key={x.name}><div className="study-constraint-number">{String(i+1).padStart(2,'0')}</div><div><h4>{x.name}</h4><code>{x.symbol}</code><p>{x.meaning}</p></div></article>)}</div>
    <p className="study-footnote">The formulation uses SciPy <code>linprog</code> with HiGHS, not PuLP. It has 2,633 decision variables, 614 equality constraints and 1,767 upper-bound constraints. There is no mixed-integer commitment or network OPF. ROR/PV curtailment is calculated as available minus dispatched, while PROR and reservoir spillage are explicit variables.</p>
  </section>
  <section className="card study-panel" id="study-economics">
    <div className="study-section-heading"><span className="study-section-num">04</span><div><h2>Economic and reliability assumptions</h2><p>Costs are not electricity purchase tariffs. The LP annualises capital investment and adds operating costs; counting a PPA tariff again as generator fuel cost would generally double-count capital recovery.</p></div></div>
    <div className="tablewrap"><table><thead><tr><th>Technology</th><th>CAPEX (USD/kW)</th><th>Fixed O&M (USD/kW-year)</th><th>Variable O&M (USD/MWh)</th><th>Lifetime (years)</th></tr></thead>
     <tbody>{[['ROR',1650,35,1.5,40],['PROR',1850,40,2,45],['Storage hydro',2500,50,2.5,50],['Solar PV',691,12,0,25]].map(x=><tr key={x[0]}><th>{x[0]}</th>{x.slice(1).map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody>
    </table></div>
    <p className="study-footnote">The reproduced run loaded the embedded version of your planning-cost CSV. It did not read the external CSV from Drive. The table is a transparent scenario input, not a verified procurement quotation.</p>
    <dl className="study-parameters">
      <div><dt>Discount rate</dt><dd>8% assumed</dd></div><div><dt>Exchange rate</dt><dd>NPR 145/USD assumed</dd></div>
      <div><dt>Import price</dt><dd>NPR 9.018/kWh, historical NEA arithmetic proxy</dd></div><div><dt>Maximum import</dt><dd>750 MW assumed</dd></div>
      <div><dt>Value of lost load</dt><dd>NPR 110.2/kWh, older JICA-cited proxy</dd></div><div><dt>Unserved energy</dt><dd>≤ 0.01% of annual demand, deterministic</dd></div>
    </dl>
  </section>
  <section className="card study-panel" id="study-boundaries">
    <div className="study-section-heading"><span className="study-section-num">05</span><div><h2>What the result can and cannot establish</h2><p>The LP returned an optimal mathematical solution and passed 12 numerical checks. That establishes internal consistency for the inputs provided; it does not establish that the assumed sites, firm capacity, finance terms or future river flows are achievable.</p></div></div>
    <div className="study-boundaries-grid"><div><h3>Reproduced by this model</h3><ul>
     <li>One 2030 capacity expansion and dispatch solution</li><li>288 hourly decisions (one day for each of 12 months)</li>
     <li>8,760 rows reconstructed by repeating monthly daily patterns</li><li>ROR/PROR/storage/PV annual energy, imports and curtailment</li>
     <li>Deterministic load balance and annual cost accounting</li>
    </ul></div><div><h3>Still outside this model</h3><ul>
     <li>Real 8,760-hour varying weather, flows and demand</li><li>Plant-level commissioning and verified ROR/PROR classification</li>
     <li>Network constraints, exports and interconnection scheduling</li><li>BESS sizing, dispatch and degradation</li>
     <li>Stochastic forced outages, LOLE and probabilistic EENS</li><li>Completed 2040/2050 optimization scenarios</li>
    </ul></div></div>
    <p className="study-source-note">Primary research source: <a href={links.jica} target="_blank" rel="noopener noreferrer">JICA IPSDP Final Report (Dec 2024) <ExternalLink size={12}/></a>, especially the middle demand table, §4.4 hydro project portfolio and 2030 scenario figures. Other notebook references: <a href={links.jicaAnnex} target="_blank" rel="noopener noreferrer">JICA Annexes <ExternalLink size={12}/></a>, <a href={links.jicaSolar} target="_blank" rel="noopener noreferrer">Solar resource discussion <ExternalLink size={12}/></a>, and <a href={links.nea} target="_blank" rel="noopener noreferrer">NEA annual reports <ExternalLink size={12}/></a>. Independent rechecking of NEA values remains necessary before an academic or policy claim.</p>
  </section>
 </div>;
}
