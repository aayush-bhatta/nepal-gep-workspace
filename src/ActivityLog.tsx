import React,{useEffect,useState} from 'react';
import {History,RefreshCw,Download} from 'lucide-react';
import {db,downloadBlob,csv} from './db';
import {errorMessage} from './errors';

type Event={id:string;occurred_at:string;entity_type:string;record_id:string|null;action:string;label:string;changed_fields:string[];actor_label:string};
const groups:Record<string,string>={inputs:'Inputs',scenarios:'Planning horizons',model_runs:'Model runs',model_run_visibility:'Model run archives',sensitivities:'Sensitivities',tasks:'Tasks',folders:'Folders',files:'Files',file_versions:'File versions',file_links:'Research links',published_entries:'Publications'};
function eventLabel(event:Event){
 const changed=(event.changed_fields||[]).map(s=>s.replaceAll('_',' '));
 return changed.length?'Changed: '+changed.join(', '):'Recorded change';
}
export function ActivityLog(){
 const[events,setEvents]=useState<Event[]>([]);
 const[loading,setLoading]=useState(false);
 const[error,setError]=useState('');
 const[filter,setFilter]=useState('all');
 const[search,setSearch]=useState('');
 async function load(){
  if(!db)return;
  setLoading(true);setError('');
  try{
   const {data,error}=await db.from('activity_events').select('id,occurred_at,entity_type,record_id,action,label,changed_fields,actor_label').order('occurred_at',{ascending:false}).limit(500);
   if(error)throw error;setEvents(data||[]);
  }catch(e){setError(errorMessage(e));}finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const filtered=events.filter(e=>(filter==='all'||e.action===filter)&&
  (e.label+' '+e.entity_type+' '+e.action).toLowerCase().includes(search.trim().toLowerCase()));
 function exportActivity(){
  const file=new Blob([csv(filtered.map(e=>({
   date:e.occurred_at,area:groups[e.entity_type]||e.entity_type,action:e.action,
   item:e.label,changed_fields:(e.changed_fields||[]).join('; '),actor:e.actor_label
  })))],{type:'text/csv;charset=utf-8'});
  downloadBlob(file,'nepal-gep-activity-log.csv');
 }
 return <section className="gep-activity">
  <div className="heading"><div><p className="eyebrow">TRACEABLE CHANGES</p><h1><History size={25}/> Activity & history</h1>
   <p>See what was added, changed, archived, restored or deleted across the research workspace.</p></div>
   <div className="actions"><button onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button><button onClick={exportActivity}><Download size={16}/> Export CSV</button></div>
  </div>
  <div className="card">
   <p className="notice">History begins when the activity-log database migration is activated. Older edits cannot be reconstructed automatically. This log records item names and field names—not raw file bytes or previous values.</p>
   <div className="tools">
    <label className="search"><input aria-label="Search activity" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a file, task or change"/></label>
    <select aria-label="Activity type" value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="all">All changes</option>
     {['added','updated','deleted','trashed','restored','archived','unarchived'].map(x=><option key={x} value={x}>{x[0].toUpperCase()+x.slice(1)}</option>)}
    </select>
   </div>
   {error&&<p role="alert" className="error">{error}</p>}
   {loading&&<p className="muted">Loading activity…</p>}
   <div className="tablewrap"><table><thead><tr><th>Date & time</th><th>Change</th><th>Research item</th><th>Details</th></tr></thead>
    <tbody>{filtered.map(e=><tr key={e.id}>
     <td><small>{new Date(e.occurred_at).toLocaleString()}</small></td>
     <td><b>{e.action[0].toUpperCase()+e.action.slice(1)}</b><br/><small className="muted">{groups[e.entity_type]||e.entity_type}</small></td>
     <td>{e.label}</td><td><small>{eventLabel(e)}</small></td>
    </tr>)}
    {!filtered.length&&<tr><td colSpan={4} className="empty">{loading?'Checking activity…':'No activity records match yet.'}</td></tr>}</tbody>
   </table></div>
   {events.length>=500&&<small className="muted">Showing 500 most recent changes. Export covers the displayed filter only.</small>}
  </div>
 </section>;
}
