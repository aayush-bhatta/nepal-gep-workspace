import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {db} from './db';
import {errorMessage} from './errors';

type Member={user_id:string;role:string;created_at:string};
const dashboard='https://supabase.com/dashboard/project/ttooxyezrvbyscexjxno/auth/users';
export function ViewerAccess(){
 const [members,setMembers]=useState<Member[]>([]);
 const [userId,setUserId]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  if(!db)return;
  const {data,error}=await db.from('workspace_members').select('user_id,role,created_at').order('created_at',{ascending:false});
  if(error)throw error;setMembers(data||[]);
 },[]);
 useEffect(()=>{void load().catch(e=>setError(errorMessage(e)));},[load]);
 async function grant(e:FormEvent){
  e.preventDefault();if(!db||busy)return;
  const id=userId.trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
   setError('Paste the complete user UID from Supabase Authentication → Users.');return;
  }
  setError('');setNotice('');setBusy(true);
  try{
   const {error}=await db.from('workspace_members').insert({user_id:id,role:'viewer'});
   if(error)throw error;
   setUserId('');await load();setNotice('Read-only viewer access granted to this existing Auth account.');
  }catch(e){setError(errorMessage(e)+' — Ensure the user exists in Supabase Authentication and does not already have membership.');}
  finally{setBusy(false);}
 }
 async function revoke(id:string){
  if(!db||busy||!confirm('Revoke access to private research and file downloads for this viewer?'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const {data,error}=await db.from('workspace_members').delete().eq('user_id',id).eq('role','viewer').select('user_id');
   if(error)throw error;if(!data?.length)throw Error('No viewer membership was removed.');
   await load();setNotice('Viewer access revoked. Their Supabase login still exists.');
  }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
 }
 return <section className="card">
  <h1>Invited viewer access</h1>
  <p>Only the Owner can grant or revoke invited viewer permissions. Viewers can read private research and download files, but cannot edit, delete, upload, publish or restore backups.</p>
  <p>First <a href={dashboard} target="_blank" rel="noopener noreferrer">invite/create the viewer in Supabase Authentication → Users</a>. Copy that user's UID here after creating their Auth account; do not share your Owner password.</p>
  <form onSubmit={e=>void grant(e)} className="tools">
   <label>User UID from Supabase Authentication
    <input required placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={userId} onChange={e=>setUserId(e.target.value)}/>
   </label>
   <button className="primary" disabled={busy}>{busy?'Granting…':'Grant read-only access'}</button>
  </form>
  {error&&<p role="alert" className="error">{error}</p>}
  {notice&&<p role="status" className="notice">{notice}</p>}
  <h2>Workspace memberships</h2>
  <p className="muted">Member UIDs are displayed instead of email addresses. Only viewer memberships can be revoked here; owner/editor accounts are protected.</p>
  <div className="compactlist">{members.map(m=><div key={m.user_id}><span>{m.user_id} · {m.role}</span>{m.role==='viewer'&&<button disabled={busy} onClick={()=>void revoke(m.user_id)}>Revoke viewer</button>}</div>)}</div>
  {!members.length&&<p className="muted">No membership records returned. Check that the viewer-access database migration is applied.</p>}
 </section>;
}
