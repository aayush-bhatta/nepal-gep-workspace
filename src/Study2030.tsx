import React,{useState} from 'react';
import {BookOpen,Download,ExternalLink,AlertTriangle,CheckCircle2} from 'lucide-react';
import {csv,downloadBlob} from './db';
import {Study2030Methodology} from './Study2030Methodology';

const repoRoot='https://github.com/aayush-bhatta/nepal-gep-workspace';
const notebookPath='/research/2030/Nepal_GEP_2030_Complete_Evidence_First.ipynb';
const notebookUrl=repoRoot+'/blob/main'+notebookPath;
const colabUrl='https://colab.research.google.com/github/aayush-bhatta/nepal-gep-workspace/blob/main'+notebookPath;
const sourceJica='https://openjicareport.jica.go.jp/pdf/12387999_01.pdf';
const sourceNea='https://www.nea.org.np/en/detail/annual-report-20252026';
type Capacity={Technology:string;Existing_2026_MW_scenario:number;Optimized_New_MW:number;Total_2030_MW:number;Max_New_MW_assumption:number;Capacity_Share_pct:number};
export const capacity:Capacity[]=[
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

export function Study2030(){
 const[month,setMonth]=useState<'dry'|'wet'>('dry');
 const existingTotal=capacity.reduce((sum,c)=>sum+c.Existing_2026_MW_scenario,0);
 const addedTotal=capacity.reduce((sum,c)=>sum+c.Optimized_New_MW,0);
 const totalCapacity=existingTotal+addedTotal;
 const maxTotal=Math.max(...capacity.map(c=>c.Total_2030_MW));
 return <section className="study-page">
  <header className="study-intro">
   <p className="eyebrow">GENERATION EXPANSION PLANNING · 2030 BASE CASE</p>
   <h1>How the 2030 generation mix was obtained</h1>
   <p>The model starts with an allocated 2026 installed fleet, decides how many additional megawatts to construct by 2030, and dispatches the combined fleet against a JICA-based electricity-demand forecast. This page documents the results together with the data construction and operating constraints that produced them.</p>
   <div className="study-statusline"><span><CheckCircle2 size={16}/> HiGHS optimal · 12 checks passed</span><span>Inputs not independently verified</span><span>288 representative hours</span></div>
  </header>
  <nav className="study-page-nav" aria-label="2030 study sections">
   <a href="#study-capacity">Capacity</a><a href="#study-energy">Annual electricity</a><a href="#study-dispatch">Dispatch</a>
   <a href="#study-evidence">Evidence & calibration</a><a href="#study-optimization">LP equations</a><a href="#study-boundaries">Limitations & sources</a>
  </nav>
  <div className="study-kpis">
   {[
    ['2026 installed baseline',fmt(existingTotal),'MW · model allocation'],
    ['New capacity by 2030',fmt(addedTotal),'MW · optimiser decision'],
    ['Total installed 2030',fmt(totalCapacity),'MW · existing + new'],
    ['2030 grid electricity',fmt(28730.5458769),'GWh/year · forecast-adjusted']
   ].map(x=><div className="card study-kpi" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></div>)}
  </div>
  <p className="study-first-note"><AlertTriangle size={17}/> <span><b>Scope of this result.</b> The solution is numerically optimal for this illustrative scenario. Some hydro classifications, the hourly resource shapes, cost benchmarks and development ceilings remain assumptions. It is not a validated national investment recommendation.</span></p>
  <section className="card study-panel" id="study-capacity">
   <div className="study-section-heading"><span className="study-section-num">RESULT 01</span><div>
    <h2>Installed capacity in 2030: existing fleet plus new construction</h2>
    <p>There are three distinct quantities in the result. The first column allocates the capacity already present in the 2026 model baseline. The second is the <em>new capacity selected by the optimisation</em>. Adding them gives installed capacity in 2030. Only the middle column is an investment decision.</p>
   </div></div>
   <div className="study-heading"><p className="muted study-table-label">Installed MW, 2026 baseline → 2030 result</p><button onClick={()=>saveCsv('nepal_gep_2030_capacity_mix.csv',capacity)}><Download size={15}/> Capacity CSV</button></div>
   <div className="tablewrap"><table className="study-capacity-table"><thead><tr>
    <th>Technology</th><th>Existing 2026 (MW)</th><th>New by 2030 (MW)</th><th>Total 2030 (MW)</th><th>Share of 2030 total</th><th>New-build ceiling (MW)</th>
   </tr></thead><tbody>
    {capacity.map(r=><tr key={r.Technology}><th scope="row">{r.Technology}</th>
      <td>{fmt(r.Existing_2026_MW_scenario)}</td><td><b>+{fmt(r.Optimized_New_MW)}</b></td><td><b>{fmt(r.Total_2030_MW)}</b></td>
      <td>{fmt(r.Capacity_Share_pct)}%</td><td>{fmt(r.Max_New_MW_assumption)}</td>
    </tr>)}
    <tr className="study-total-row"><th scope="row">TOTAL</th><td>{fmt(existingTotal)}</td><td>+{fmt(addedTotal)}</td><td>{fmt(totalCapacity)}</td><td>100%</td><td>—</td></tr>
   </tbody></table></div>
   <h3 className="study-inline-heading">What makes up each 2030 total?</h3>
   <div className="study-bar-key"><span><i className="study-key-existing"/>Modelled existing 2026</span><span><i className="study-key-new"/>New MW chosen for 2030</span></div>
   <div className="study-capacity-bars">{capacity.map(c=><div className="study-capacity-row" key={c.Technology}>
     <span>{c.Technology}</span>
     <div className="study-capacity-track" aria-label={c.Technology+' existing '+fmt(c.Existing_2026_MW_scenario)+' new '+fmt(c.Optimized_New_MW)}>
      <span className="study-capacity-existing" style={{width:(c.Existing_2026_MW_scenario/maxTotal*100)+'%'}}/>
      <span className="study-capacity-new" style={{width:(c.Optimized_New_MW/maxTotal*100)+'%'}}/>
     </div><b>{fmt(c.Total_2030_MW)} MW</b>
    </div>)}</div>
   <p className="study-interpretation">The model builds substantial new PROR and PV capacity. The solar and storage-hydro results reach the model's assumed new-build ceilings, which makes those ceilings important to the answer. They are indicative portfolio screens, not independently verified 2030 commissioning limits. The 2026 hydro allocation also assigns 1,077.481 MW of unclassified capacity to ROR-like operation; the split must be tested before claiming that these exact technologies should be built.</p>
  </section>
  <section className="card study-panel" id="study-energy">
   <div className="study-section-heading"><span className="study-section-num">RESULT 02</span><div>
    <h2>How the 2030 demand is supplied</h2>
    <p>Installed megawatts are not the same as annual electricity delivered. The LP dispatches the selected capacity subject to seasonal river availability, hourly PV availability, reservoir energy budgets and import limits.</p>
   </div></div>
   <div className="study-heading"><p className="muted study-table-label">Annual electricity supply (GWh/year)</p><button onClick={()=>saveCsv('nepal_gep_2030_energy_mix.csv',energy)}><Download size={15}/> Energy CSV</button></div>
   <div className="tablewrap"><table><thead><tr><th>Source</th><th>Energy (GWh)</th><th>Share of total demand</th><th>Share of domestic generation</th></tr></thead><tbody>
    {energy.map(r=><tr key={r.Resource}><th scope="row">{r.Resource}</th><td>{fmt(r.Energy_GWh)}</td><td>{fmt(r.Share_of_Annual_Demand_pct)}%</td><td>{r.Resource==='Imports'||r.Resource==='Unserved'?'—':fmt(r.Share_of_Domestic_Generation_pct)+'%'}</td></tr>)}
    <tr className="study-total-row"><th>Demand served + unserved</th><td>{fmt(28730.5458769)}</td><td>100%</td><td>—</td></tr>
   </tbody></table></div>
   <p className="study-interpretation">Domestic technologies supply <b>27,189.94 GWh</b>; imports provide another <b>1,540.61 GWh</b>. The denominator for the third column is total grid demand, including imports. The fourth column uses domestic generation only. The model reports <b>929.21 GWh of unused river/PV potential</b> and zero deterministic unserved energy in this run. Neither result establishes real-world firm adequacy or reliability during outages.</p>
  </section>
  <section className="card study-panel" id="study-dispatch">
   <div className="study-section-heading"><span className="study-section-num">RESULT 03</span><div>
    <h2>Dry-season and wet-season dispatch</h2>
    <p>One representative day is optimised for each month. February has the weakest modelled river availability; August has the strongest. The area under each coloured band is dispatched MW, while the dark line is the same demand profile in both months.</p>
   </div></div>
   <div className="study-heading"><div className="study-segmented" role="group" aria-label="Representative dispatch month">
     <button type="button" className={month==='dry'?'active':''} onClick={()=>setMonth('dry')}>February · dry</button>
     <button type="button" className={month==='wet'?'active':''} onClick={()=>setMonth('wet')}>August · wet</button>
   </div></div>
   <StackedDispatch data={month==='dry'?dry:wet} label={month==='dry'?'February (dry-season representative day)':'August (wet-season representative day)'}/>
   <p className="study-interpretation">{month==='dry'?
     'In February, low ROR availability and limited PROR water make imports and flexible hydro important. The model uses its 750 MW import ceiling through the representative day.':
     'In August, higher river availability displaces imported electricity in this representative day; some potential generation is unused because the model does not allow exports.'}
   </p>
   <p className="study-footnote">The figure plots output rows from the solved LP, rounded for display. Twelve 24-hour representative days provide 288 solved hours; identical daily dispatch is then repeated by month to create 8,760 reconstructed hours. This is not a chronological hourly power-system simulation with varying weather or outages.</p>
  </section>
  <section className="card study-panel" id="study-cost">
   <div className="study-section-heading"><span className="study-section-num">RESULT 04</span><div>
    <h2>Annualised system cost</h2>
    <p>All categories are converted to NPR million per year. The model counts annualised construction of new plants, fixed O&M of both existing and new capacity, variable generation costs, and imports. It does not add a PPA tariff on top of investment recovery.</p>
   </div></div>
   <div className="study-heading"><p className="muted study-table-label">Cost reconstruction from the solved investment and dispatch</p><button onClick={()=>saveCsv('nepal_gep_2030_annual_costs.csv',costs)}><Download size={15}/> Cost CSV</button></div>
   <div className="tablewrap"><table><thead><tr><th>Cost component</th><th>NPR million / year</th><th>NPR billion / year</th></tr></thead>
   <tbody>{costs.map(x=><tr key={x.Cost_Component}><th scope="row">{x.Cost_Component}</th><td>{fmt(x.Million_NPR_per_year)}</td><td>{fmt(x.Million_NPR_per_year/1000)}</td></tr>)}
    <tr className="study-total-row"><th>Total annual model cost</th><td>{fmt(costs.reduce((sum,x)=>sum+x.Million_NPR_per_year,0))}</td><td>{fmt(costs.reduce((sum,x)=>sum+x.Million_NPR_per_year,0)/1000)}</td></tr>
   </tbody></table></div>
   <p className="study-footnote">Investment CAPEX, exchange rate, economic lives, discount rate, generation O&M and import price are scenario inputs, not independently audited Nepal 2030 project contracts. Details of the formula and their units are provided below.</p>
  </section>
  <Study2030Methodology/>
  <section className="card study-panel" id="study-reproducibility">
   <div className="study-section-heading"><span className="study-section-num">06</span><div>
    <h2>Notebook, data and reproducibility</h2><p>The versioned Colab notebook contains all model variables, sparse constraint matrices, data-calibration steps, 12 numerical checks and CSV exports. It can be run independently and audited alongside the study tables.</p>
   </div></div>
   <div className="study-links">
    <a href={colabUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={17}/> Run the 2030 notebook in Google Colab <ExternalLink size={14}/></a>
    <a href={notebookUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={17}/> View source and versions on GitHub <ExternalLink size={14}/></a>
    <a href={sourceJica} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> JICA IPSDP Final Report 2024</a>
    <a href={sourceNea} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> NEA annual report archive</a>
   </div>
   <p className="study-footnote">Software: Python SciPy <code>linprog</code> / HiGHS. Model size: 2,633 variables, 614 equality constraints and 1,767 upper-bound constraints. 2026 plant classifications and project-level investment feasibility still require verification. No BESS or completed 2040/2050 model results are included.</p>
  </section>
 </section>;
}
