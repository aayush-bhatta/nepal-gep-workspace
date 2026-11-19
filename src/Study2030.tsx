import React,{useState} from 'react';
import {BookOpen,Download,ExternalLink,AlertTriangle,CheckCircle2} from 'lucide-react';
import {csv,downloadBlob} from './db';

const repoRoot='https://github.com/aayush-bhatta/nepal-gep-workspace';
const notebookPath='/research/2030/Nepal_GEP_2030_Complete_Evidence_First.ipynb';
const notebookUrl=repoRoot+'/blob/main'+notebookPath;
const colabUrl='https://colab.research.google.com/github/aayush-bhatta/nepal-gep-workspace/blob/main'+notebookPath;
const sourceJica='https://openjicareport.jica.go.jp/pdf/12387999_01.pdf';
const sourceNea='https://www.nea.org.np/en/detail/annual-report-20252026';
type Capacity={Technology:string;Existing_2026_MW_scenario:number;Optimized_New_MW:number;Total_2030_MW:number;Max_New_MW_assumption:number;Capacity_Share_pct:number};
const capacity:Capacity[]=[
 {Technology:'ROR',Existing_2026_MW_scenario:2950.466,Optimized_New_MW:271.339657,Total_2030_MW:3221.805657,Max_New_MW_assumption:4893.234,Capacity_Share_pct:35.887608},
 {Technology:'PROR',Existing_2026_MW_scenario:844.9,Optimized_New_MW:1946.682149,Total_2030_MW:2791.582149,Max_New_MW_assumption:2866.7,Capacity_Share_pct:31.09536},
 {Technology:'Storage Hydro',Existing_2026_MW_scenario:106,Optimized_New_MW:675.4,Total_2030_MW:781.4,Max_New_MW_assumption:675.4,Capacity_Share_pct:8.703994},
 {Technology:'Solar PV',Existing_2026_MW_scenario:154.94,Optimized_New_MW:2027.76,Total_2030_MW:2182.7,Max_New_MW_assumption:2027.76,Capacity_Share_pct:24.313038}
];
type Energy={Resource:string;Energy_GWh:number;Share_of_Annual_Demand_pct:number;Share_of_Domestic_Generation_pct:number};
const energy:Energy[]=[
 {Resource:'ROR',Energy_GWh:17192.339725,Share_of_Annual_Demand_pct:59.839934,Share_of_Domestic_Generation_pct:63.230525},
 {Resource:'PROR',Energy_GWh:5879.545742,Share_of_Annual_Demand_pct:20.464441,Share_of_Domestic_Generation_pct:21.623977},
 {Resource:'Storage Hydro',Energy_GWh:867.574554,Share_of_Annual_Demand_pct:3.019694,Share_of_Domestic_Generation_pct:3.190793},
 {Resource:'Solar PV',Energy_GWh:3250.47684,Share_of_Annual_Demand_pct:11.313662,Share_of_Domestic_Generation_pct:11.954705},
 {Resource:'Imports',Energy_GWh:1540.609016,Share_of_Annual_Demand_pct:5.362269,Share_of_Domestic_Generation_pct:0},
 {Resource:'Unserved',Energy_GWh:0,Share_of_Annual_Demand_pct:0,Share_of_Domestic_Generation_pct:0}
];
const costs=[
 {Cost_Component:'Annualized new investment',Million_NPR_per_year:87617.065696},
 {Cost_Component:'Fixed O&M (all installed)',Million_NPR_per_year:42004.888176},
 {Cost_Component:'Variable generation O&M',Million_NPR_per_year:5758.897931},
 {Cost_Component:'Imports (historical-price proxy)',Million_NPR_per_year:13893.109487},
 {Cost_Component:'Modeled cost of unserved energy',Million_NPR_per_year:0}
];
const modelDemand=[2441.78,2281.74,2175.05,2121.71,2121.71,2228.4,2761.85,3455.34,3775.41,3668.72,3508.68,3401.99,3401.99,3348.65,3348.65,3508.68,3775.41,4308.86,4682.27,4949,4148.82,3615.37,3028.58,2655.16];
// Hourly layers: ROR, PROR, storage hydro, solar PV, imports (MW).
// Directly transcribed from the model's 08_dispatch_288_representative_hours.csv.
// All values below are rounded to 0.01 MW for visualization only.
const dry:number[][]=[
 [873.47,818.31,0,0,750],[873.47,509,149.28,0,750],[873.47,0,551.59,0,750],
 [873.47,0,498.24,0,750],[873.47,0,498.24,0,750],[873.47,0,604.93,0,750],
 [873.47,462.98,675.4,0,750],[873.47,832.95,675.4,323.52,750],
 [873.47,851.55,675.4,624.99,750],[873.47,485.98,675.4,883.87,750],
 [873.47,127.3,675.4,1082.51,750],[873.47,0,571.14,1207.39,750],
 [873.47,0,528.55,1249.98,750],[873.47,0,517.79,1207.39,750],
 [873.47,0,642.67,1082.51,750],[873.47,325.95,675.4,883.87,750],
 [873.47,851.55,675.4,624.99,750],[873.47,1634.82,727.05,323.52,750],
 [873.47,2383.41,675.4,0,750],[873.47,2650.13,675.4,0,750],
 [873.47,1849.96,675.4,0,750],[873.47,1316.5,675.4,0,750],
 [873.47,729.71,675.4,0,750],[873.47,356.29,675.4,0,750]
];
const wet:number[][]=[
 [2441.78,0,0,0,0],[2281.74,0,0,0,0],[2175.05,0,0,0,0],
 [2121.71,0,0,0,0],[2121.71,0,0,0,0],[2228.4,0,0,0,0],
 [2761.85,0,0,0,0],[2911.56,305.9,0,237.88,0],[2911.56,404.3,0,459.55,0],
 [2911.56,107.26,0,649.9,0],[2712.72,0,0,795.96,0],[2514.21,0,0,887.78,0],
 [2482.89,0,0,919.1,0],[2460.86,0,0,887.78,0],[2552.68,0,0,795.96,0],
 [2858.78,0,0,649.9,0],[2911.56,404.3,0,459.55,0],[2911.56,1159.42,0,237.88,0],
 [2911.56,1770.71,0,0,0],[2911.56,2037.44,0,0,0],[2911.56,1237.26,0,0,0],
 [2911.56,703.81,0,0,0],[2911.56,117.02,0,0,0],[2655.16,0,0,0,0]
];
const names=['ROR','PROR','Storage hydro','Solar PV','Imports'];
const colors=['#225f51','#87b9a4','#b49970','#f0c65e','#648fc4'];
const fmt=(n:number,digits=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n);
function saveCsv(name:string,rows:Record<string,unknown>[]){
 downloadBlob(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),name);
}
function StackedDispatch({data,label}:{data:number[][];label:string}){
 const x=(h:number)=>52+h*28.5;
 const y=(v:number)=>235-(v/5200)*207;
 const polygon=(index:number)=>{
  const upper=data.map((row,h)=>[x(h),y(row.slice(0,index+1).reduce((a,b)=>a+b,0))]);
  const lower=data.map((row,h)=>[x(h),y(row.slice(0,index).reduce((a,b)=>a+b,0))]).reverse();
  return 'M '+[...upper,...lower].map(([a,b])=>a.toFixed(1)+','+b.toFixed(1)).join(' L ')+' Z';
 };
 const demandLine=modelDemand.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
 return <figure className="study-figure">
  <figcaption>{label} — representative 24-hour modeled dispatch</figcaption>
  <svg viewBox="0 0 760 266" role="img" aria-label={label+' hour-by-hour generation stack compared with demand in megawatts'}>
   {[0,1000,2000,3000,4000,5000].map(n=><g key={n}>
    <line x1="48" y1={y(n)} x2="718" y2={y(n)} stroke="#e0e9e2" strokeWidth="1"/>
    <text x="43" y={y(n)+4} fontSize="11" textAnchor="end" fill="#61776d">{n===0?'0':String(n/1000)+'k'}</text>
   </g>)}
   {data[0].map((_,index)=><path key={index} d={polygon(index)} fill={colors[index]} opacity=".94"/>)}
   <polyline points={demandLine} stroke="#263b36" strokeWidth="2.6" fill="none"/>
   {[0,4,8,12,16,20,23].map(h=><text key={h} x={x(h)} y="258" textAnchor="middle" fontSize="12" fill="#61776d">{h}:00</text>)}
  </svg>
  <div className="study-legend">{names.map((n,i)=><span key={n}><i style={{background:colors[i]}}/>{n}</span>)}<span><i className="study-demand-line"/>Demand</span></div>
  <small className="muted">MW · Model output rounded for display; not an observed daily load curve. The same synthetic load shape applies to every month.</small>
 </figure>;
}
const methods=[
 {name:'Demand',kind:'JICA source + synthetic shape',detail:'24,737 GWh consumer energy; assumed 13.9% loss → 28,730.55 GWh grid energy. Sending-end peak 4,949 MW. A repeated 24-point daily load shape constructs 8,760 synthetic hours.'},
 {name:'Hydrology',kind:'2040 resource proxy, not observation',detail:'ROR and PROR annual planning CFs of 64.21% and 56.49%, calibrated to illustrative wet/dry monthly factors. PROR has a six-hour cyclic pondage assumption.'},
 {name:'Installed hydro',kind:'NEA aggregate + unresolved classification',detail:'3,901.366 MW total 2026 hydro plus 154.940 MW solar. 1,077.481 MW hydro is unclassified and assigned ROR-like behavior in this scenario; 904.600 MW of ROR-family links still require source recheck.'},
 {name:'Storage hydro',kind:'Historical generation + new reservoir proxy',detail:'106 MW existing Kulekhani chain with historical 92.362 GWh annual output. Candidate seasonal reservoir modeled with 900 MWh per MW, a site-dependent assumption.'},
 {name:'Solar',kind:'Synthetic profile',detail:'Assumed 17% annual capacity factor and 12 monthly cloudiness weights, combined with a 24-hour sine-shaped availability curve; not measured site-level solar time series.'},
 {name:'Cost / trade / reliability',kind:'Planning scenarios',detail:'Embedded cost benchmarks; 145 NPR/USD, 8% discount rate, 750 MW import cap, historical import-price proxy ~9.02 NPR/kWh, VOLL 110.2 NPR/kWh, deterministic ENS limit 0.01%.'}
];
export function Study2030(){
 const[month,setMonth]=useState<'dry'|'wet'>('dry');
 return <section className="study-page">
  <div className="heading"><div>
   <p className="eyebrow">2030 · REPRODUCIBLE MODEL EVIDENCE</p>
   <h1>2030 optimization study</h1>
   <p>One-node Nepal GEP · JICA middle-case demand · SciPy HiGHS linear program</p>
  </div></div>
  <div className="study-warning"><AlertTriangle size={19}/><div><b>Illustrative modeled optimum—not a verified construction recommendation.</b><p>The solver passed its mathematical checks, but classification, hourly profiles, investment caps and cost inputs remain partly provisional. No 2040/2050 results or BESS results are implied.</p></div></div>
  <div className="study-kpis">
   {[['Total capacity','8,977.49','MW'],['Annual grid demand','28,730.55','GWh'],['Annual modeled cost','149.27','NPR billion'],['Unserved energy','0','GWh']].map(x=><div className="card study-kpi" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></div>)}
  </div>
  <section className="card study-panel"><div className="study-heading"><h2>Capacity expansion mix</h2><button onClick={()=>saveCsv('nepal_gep_2030_capacity_mix.csv',capacity)}> <Download size={15}/> Export CSV</button></div>
   <p className="muted">Existing capacity is a modeled 2026 technology allocation, not an official technology-level classification. New capacity comes directly from the LP solution.</p>
   <div className="tablewrap"><table><thead><tr><th>Technology</th><th>Existing MW</th><th>New MW</th><th>Total 2030 MW</th><th>Capacity share</th></tr></thead><tbody>
    {capacity.map(r=><tr key={r.Technology}><td><b>{r.Technology}</b></td><td>{fmt(r.Existing_2026_MW_scenario)}</td><td>{fmt(r.Optimized_New_MW)}</td><td>{fmt(r.Total_2030_MW)}</td><td>{fmt(r.Capacity_Share_pct)}%</td></tr>)}
   </tbody></table></div>
   <div className="study-bars">{capacity.map((r,i)=><div key={r.Technology}><span>{r.Technology}</span><div className="study-bar-track"><div style={{width:(r.Capacity_Share_pct)+'%',background:colors[i]}}/></div><b>{fmt(r.Capacity_Share_pct,1)}%</b></div>)}</div>
   <p className="study-footnote">The assumed new-build ceilings are binding for storage hydro and solar PV. No verified 2030 site commissioning schedule is claimed.</p>
  </section>
  <section className="card study-panel"><div className="study-heading"><h2>Annual electricity supply</h2><button onClick={()=>saveCsv('nepal_gep_2030_energy_mix.csv',energy)}> <Download size={15}/> Export CSV</button></div>
   <p className="muted">Two denominators are shown: total grid supply including imports (28,730.55 GWh), and domestic production only (27,189.94 GWh).</p>
   <div className="tablewrap"><table><thead><tr><th>Resource</th><th>GWh</th><th>% of grid demand</th><th>% of domestic generation</th></tr></thead><tbody>
    {energy.map(r=><tr key={r.Resource}><td>{r.Resource}</td><td>{fmt(r.Energy_GWh)}</td><td>{fmt(r.Share_of_Annual_Demand_pct)}%</td><td>{r.Resource==='Imports'||r.Resource==='Unserved'?'—':fmt(r.Share_of_Domestic_Generation_pct)+'%'}</td></tr>)}
   </tbody></table></div>
   <p className="study-footnote">Hydro and PV curtailment: 929.207 GWh. Deterministic ENS: 0 GWh; this is not a probabilistic LOLE/EENS reliability result. No exports modeled.</p>
  </section>
  <section className="card study-panel">
   <div className="study-heading"><h2>Daily dispatch comparison</h2><div className="study-segmented">
    <button type="button" className={month==='dry'?'active':''} onClick={()=>setMonth('dry')}>February · dry</button>
    <button type="button" className={month==='wet'?'active':''} onClick={()=>setMonth('wet')}>August · wet</button>
   </div></div>
   <StackedDispatch data={month==='dry'?dry:wet} label={month==='dry'?'February dry season':'August wet season'}/>
   <p className="study-footnote">These figures are calculated from the optimized 288 representative hourly decisions, not fabricated charts. All 12 monthly days repeat within their month to reconstruct the 8,760-hour dispatch.</p>
  </section>
  <section className="card study-panel">
   <h2>What went into the model?</h2>
   <div className="study-methods">{methods.map(m=><article key={m.name}><div><b>{m.name}</b><small>{m.kind}</small></div><p>{m.detail}</p></article>)}</div>
  </section>
  <section className="card study-panel">
   <h2>Optimization formulation and scope</h2>
   <p>Minimize annualized new-build CAPEX, fixed O&M, variable generation cost, import cost and modeled value of unserved energy, subject to hourly demand balance, availability limits, water budgets and investment ceilings.</p>
   <div className="study-math">
    <div><b>Energy balance</b><code>ROR + PROR + Storage + Solar + Imports + ENS = Demand</code></div>
    <div><b>ROR / solar limits</b><code>Dispatch ≤ (Existing MW + New MW) × hourly resource availability</code></div>
    <div><b>PROR water balance</b><code>Pondage(h+1) = Pondage(h) + inflow − dispatch − spill</code></div>
    <div><b>Storage hydro balance</b><code>Reservoir(m+1) = Reservoir(m) + monthly inflow − generation − spill</code></div>
    <div><b>Reliability</b><code>Deterministic ENS ≤ 0.01% of modeled annual grid energy</code></div>
   </div>
   <p className="muted">2,633 LP variables; 614 equality and 1,767 upper-bound constraints. 12 representative days × 24 hours = 288 optimized hourly states; 8,760 rows are reconstructed, not independently optimized. All 12 notebook validation checks passed on a local rerun.</p>
  </section>
  <section className="card study-panel"><div className="study-heading"><h2>Annual cost breakdown</h2><button onClick={()=>saveCsv('nepal_gep_2030_annual_costs.csv',costs)}><Download size={15}/> Export CSV</button></div>
   <div className="tablewrap"><table><thead><tr><th>Component</th><th>NPR million / year</th></tr></thead><tbody>
    {costs.map(x=><tr key={x.Cost_Component}><td>{x.Cost_Component}</td><td>{fmt(x.Million_NPR_per_year)}</td></tr>)}
    <tr><th>Total modeled annual system cost</th><th>{fmt(costs.reduce((a,b)=>a+b.Million_NPR_per_year,0))}</th></tr>
   </tbody></table></div>
   <p className="muted">Model cost accounting uses a historical import-price proxy and embedded cost benchmarks; tariff and investment uncertainties require sensitivity analysis.</p>
  </section>
  <section className="card study-panel">
   <div className="study-heading"><h2>Reproduce and inspect the evidence</h2><CheckCircle2 size={20} color="#2e6d50"/></div>
   <div className="study-links">
    <a href={colabUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={17}/> Open exact notebook in Google Colab <ExternalLink size={14}/></a>
    <a href={notebookUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={17}/> View versioned notebook on GitHub <ExternalLink size={14}/></a>
    <a href={sourceJica} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> JICA Integrated Power System Development Plan (2024)</a>
    <a href={sourceNea} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> NEA A Year in Review FY2025/26 (notebook's cited source)</a>
   </div>
   <p className="study-footnote">The input register, model-run record and research log contain separate provenance and uncertainty notes. The exact notebook runs top to bottom without external Drive inputs by using its clearly labelled embedded fallback benchmarks.</p>
  </section>
 </section>;
}
