import {errorMessage} from './errors';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {FolderOpen,FolderPlus,FilePlus,Download,Eye,ExternalLink,Trash2,RefreshCw,FolderInput,BookOpen,Archive,Upload,Undo2,History,Link2} from 'lucide-react';
import {visibleFolders,folderOccupied} from './folderUtils';
import {rows} from './db';
import {db,bucket,downloadBlob} from './db';
import {fileExtension,bytes,sha256,compactDate,safeExternalUrl,colabUrl,MAX_UPLOAD} from './fileUtils';
import {FilePreview} from './FilePreview';
import {makeBackup,openBackup,restoreBackup,type OpenedArchive} from './backup';

type RecordRow={id:string;[key:string]:any};
const FIELD_LABELS:Record<string,string>={notes:'Research notes / assumptions',research_role:'Research purpose',document_title:'Source / paper title',authors:'Authors / organization',publication_year:'Publication year',source_url:'Original public source URL',source_reference:'Page, table, figure or DOI',source_access_date:'Date source accessed',external_url:'Google Colab / Drive / GitHub notebook URL',tags:'Tags (comma separated)'};
const ROLES=['Input','Paper / source','Methodology / code','Result','Report','Other'];
const fieldKeys=['notes','research_role','document_title','authors','publication_year','source_url','source_reference','source_access_date','external_url','tags'] as const;

function Metadata({file,versions,links,onClose,onSaved}:{file:RecordRow;versions:RecordRow[];links:RecordRow[];onClose:()=>void;onSaved:()=>void}){
  const [draft,setDraft]=useState<Record<string,any>>({...file,tags:(file.tags||[]).join(', ')});
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const currentVersions=versions.filter(v=>v.file_id===file.id).sort((a,b)=>b.version_number-a.version_number);
  async function save(){
    if(!db)return;setBusy(true);setError('');
    try{
      for(const key of ['source_url','external_url'] as const){
        if(draft[key] && !safeExternalUrl(draft[key]))throw Error(`${FIELD_LABELS[key]} must begin with https://`);
      }
      const payload:Record<string,unknown>={};
      for(const key of fieldKeys){
        if(key==='tags')payload.tags=String(draft.tags||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30);
        else if(key==='publication_year')payload[key]=draft[key]?Number(draft[key]):null;
        else if(key==='research_role')payload[key]=draft[key]||'Other';
        else payload[key]=draft[key]||null;
      }
      if(payload.publication_year && (Number(payload.publication_year)<1850 || Number(payload.publication_year)>2100))throw Error('Publication year is outside the accepted range');
      const {error}=await db.from('files').update(payload).eq('id',file.id);
      if(error)throw error;
      onSaved();onClose();
    }catch(e){setError(errorMessage(e));}finally{setBusy(false);}
  }
  return <div className="overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="modal file-modal" role="dialog" aria-modal="true" aria-label="Research file details">
      <header><h2>Research file details</h2><button onClick={onClose}>Close</button></header>
      <p className="muted">{file.original_name} · {bytes(file.byte_size)} · current version {file.current_version} · {file.trashed_at?'Trashed':'Active'}</p>
      <p className="muted">SHA-256: <code>{file.sha256||'Not recorded for original upload'}</code></p>
      <div className="fields">
        {fieldKeys.map(key=><label key={key}>{FIELD_LABELS[key]}
          {key==='research_role'?<select value={draft[key]||'Other'} onChange={e=>setDraft({...draft,[key]:e.target.value})}>{ROLES.map(role=><option key={role}>{role}</option>)}</select>
            :key==='notes'?<textarea rows={4} value={draft[key]||''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>
              :<input type={key==='publication_year'?'number':key==='source_access_date'?'date':'text'} value={draft[key]||''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>}
        </label>)}
      </div>
      <h3>Recorded versions (earlier bytes retained)</h3>
      <div className="version-list">
        {currentVersions.map(v=><div key={v.id}>v{v.version_number} · {v.original_name} · {bytes(v.byte_size)} · {compactDate(v.created_at)} <span className="muted">SHA-256 {v.sha256||'not recorded'}</span></div>)}
        {!currentVersions.length&&<p>No history recorded yet.</p>}
      </div>
      <h3>Research links</h3>
      <div className="version-list">{links.filter(v=>v.file_id===file.id).map(link=><div key={link.id}>{link.record_type}: <code>{link.record_id}</code></div>)}{!links.some(x=>x.file_id===file.id)&&<p className="muted">No linked input, scenario, run or task yet.</p>}</div>
      {error&&<p className="error" role="alert">{error}</p>}
      <footer><button onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save provenance'}</button></footer>
    </section>
  </div>;
}

export function FileWorkspace({role,onChanged}:{role:string;onChanged?:()=>void}){
  const [folder,setFolder]=useState('');const [folders,setFolders]=useState<RecordRow[]>([]);
  const [files,setFiles]=useState<RecordRow[]>([]);const [versions,setVersions]=useState<RecordRow[]>([]);const [links,setLinks]=useState<RecordRow[]>([]);
  const [search,setSearch]=useState('');const [includeTrash,setIncludeTrash]=useState(false);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState('');const [selected,setSelected]=useState<RecordRow|null>(null);
  const [preview,setPreview]=useState<{file:RecordRow;version?:RecordRow}|null>(null);
  const [archive,setArchive]=useState<OpenedArchive|null>(null);
  const replaceInput=useRef<HTMLInputElement|null>(null);const [replaceTarget,setReplaceTarget]=useState<RecordRow|null>(null);
  const archiveInput=useRef<HTMLInputElement|null>(null);
  const allowed=role==='owner'||role==='editor';
  const load=useCallback(async()=>{
    if(!db||!allowed)return;setError('');
    const tables=['folders','files','file_versions','file_links'] as const;
    const results=await Promise.all(tables.map(async table=>{
      return rows(table);
    }));
    setFolders(results[0]);setFiles(results[1]);setVersions(results[2]);setLinks(results[3]);
    onChanged?.();
  },[allowed,onChanged]);
  useEffect(()=>{void load().catch(e=>setError(errorMessage(e)));},[load]);

  const navigationFolders=visibleFolders(folders,files);
  const foldersHere=navigationFolders.filter(f=>f.path.startsWith(folder?folder+'/':'') && f.path.slice(folder?folder.length+1:0).split('/').length===1).sort((a,b)=>a.path.localeCompare(b.path));
  const shownFiles=files.filter(f=>(includeTrash||!f.trashed_at) && (search?f.original_name.toLowerCase().includes(search.toLowerCase())||String(f.document_title||'').toLowerCase().includes(search.toLowerCase()):f.folder_path===folder)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const done=async(message:string,action:()=>Promise<string|void>)=>{
    setBusy(message);setError('');setNotice('');
    try{const detail=await action();await load();setNotice(detail||`${message} completed.`);}catch(e){setError(errorMessage(e));}finally{setBusy('');}
  };
  async function addFolder(){
    const name=prompt('Name for new folder');if(name===null)return;
    if(!name.trim()||name.includes('/')||name.includes('\\')||name.includes('..')){setError('Invalid folder name');return;}
    const path=(folder?folder+'/':'')+name.trim();
    await done('Create folder',async()=>{const {error}=await db!.from('folders').insert({path});if(error)throw error;});
  }
  async function editFolder(current:RecordRow){
    const name=prompt('New folder name',current.path.split('/').at(-1));if(name===null)return;
    const parent=prompt('Destination parent folder path (empty means root)',current.path.split('/').slice(0,-1).join('/'));if(parent===null)return;
    await done('Move / rename folder',async()=>{const {data,error}=await db!.rpc('gep_move_folder',{p_old_path:current.path,p_destination:parent.trim(),p_name:name.trim()});if(error)throw error;if(folder===current.path||folder.startsWith(current.path+'/'))setFolder(data+folder.slice(current.path.length));});
  }
  async function deleteFolder(current:RecordRow){
    if(folderOccupied(current.path,folders,files)){setError('Folder contains files (including trash) or subfolders; move them first.');return;}
    if(!confirm(`Delete empty folder "${current.path}"? This does not delete files.`))return;
    await done('Delete empty folder',async()=>{const {error}=await db!.rpc('gep_delete_empty_folder',{p_path:current.path});if(error)throw error;});
  }
  async function upload(newFiles:FileList|null){
    if(!newFiles?.length)return;
    await done(`Upload ${newFiles.length} file(s)`,async()=>{
      for(const file of Array.from(newFiles)){
        if(file.size>MAX_UPLOAD)throw Error(`${file.name} exceeds 20 MB. Earlier files may already have uploaded.`);
        setBusy(`Uploading ${file.name}`);
        const key=`objects/${crypto.randomUUID()}`;
        const hash=await sha256(file);
        const {error:upError}=await db!.storage.from(bucket).upload(key,file,{upsert:false,contentType:file.type||'application/octet-stream'});
        if(upError)throw upError;
        const {error:rowError}=await db!.from('files').insert({folder_path:folder,original_name:file.name,storage_path:key,byte_size:file.size,mime_type:file.type||null,sha256:hash,research_role:'Other',current_version:1});
        if(rowError)throw Error(`${errorMessage(rowError)}. Uploaded object retained at ${key}; a network error can occur after a successful commit. Refresh before retrying.`);
      }
    });
  }
  async function replaceVersion(newFiles:FileList|null){
    const target=replaceTarget;if(!target||!newFiles?.length)return;
    const file=newFiles[0];setReplaceTarget(null);
    if(file.size>MAX_UPLOAD){setError('File exceeds 20 MB');return;}
    await done('Save new version',async()=>{
      setBusy(`Uploading new version of ${target.original_name}`);
      const key=`objects/${crypto.randomUUID()}`;const hash=await sha256(file);
      const {error:upErr}=await db!.storage.from(bucket).upload(key,file,{upsert:false,contentType:file.type||'application/octet-stream'});
      if(upErr)throw upErr;
      const {error}=await db!.rpc('gep_register_file_version',{p_file_id:target.id,p_storage_path:key,p_original_name:file.name,p_byte_size:file.size,p_mime_type:file.type||null,p_sha256:hash,p_notes:'User uploaded replacement version'});
      if(error)throw Error(`${errorMessage(error)}. Uploaded version retained at ${key}; refresh history before retrying because the transaction may have committed.`);
    });
  }
  async function download(file:RecordRow,version?:RecordRow){
    const {data,error}=await db!.storage.from(bucket).download((version||file).storage_path);
    if(error||!data){setError(`Download failed: ${error?.message||'missing object'}`);return;}
    downloadBlob(data,(version||file).original_name);
  }
  async function move(file:RecordRow){
    const destination=prompt('Move to folder path (empty for All folders/root)',file.folder_path||'');if(destination===null)return;
    const path=destination.trim();if(path&&!navigationFolders.some(f=>f.path===path)){setError('Create the destination folder first');return;}
    await done('Move file',async()=>{const {error}=await db!.from('files').update({folder_path:path}).eq('id',file.id);if(error)throw error;});
  }
  async function rename(file:RecordRow){
    const name=prompt('New display filename',file.original_name);if(name===null)return;
    if(!name.trim()||name.includes('/')||name.includes('\\')){setError('Invalid filename');return;}
    await done('Rename file',async()=>{const {error}=await db!.from('files').update({original_name:name.trim()}).eq('id',file.id);if(error)throw error;});
  }
  async function link(file:RecordRow){
    const t=prompt('Record type: inputs, scenarios, model_runs, sensitivities, tasks','inputs');
    if(!t||!['inputs','scenarios','model_runs','sensitivities','tasks'].includes(t))return;
    const id=prompt('Record UUID to associate with this file');if(!id)return;
    const {data,error}=await db!.from(t).select('id').eq('id',id).maybeSingle();
    if(error||!data){setError('No accessible record has that ID');return;}
    await done('Link file to research record',async()=>{const {error}=await db!.from('file_links').insert({file_id:file.id,record_type:t,record_id:id});if(error)throw error;});
  }
  async function toggleTrash(file:RecordRow){
    await done(file.trashed_at?'Restore file':'Move file to trash',async()=>{
      const {error}=await db!.from('files').update({trashed_at:file.trashed_at?null:new Date().toISOString()}).eq('id',file.id);
      if(error)throw error;
    });
  }
  async function backup(){
    if(!db)return;
    await done('Full research backup',async()=>{
      const file=await makeBackup(db!,setNotice);
      downloadBlob(file,`nepal-gep-complete-backup-${new Date().toISOString().slice(0,10)}.zip`);
      return `Full backup downloaded (${bytes(file.size)}). Store a copy outside Supabase.`;
    });
  }
  async function chooseArchive(file:File|undefined){
    if(!file)return;setError('');setArchive(null);setBusy('Checking backup');
    try{setArchive(await openBackup(file,setNotice));}catch(e){setError(errorMessage(e));}finally{setBusy('');}
  }
  async function restore(){
    if(!archive||!confirm('Restore missing records and files from this archive? Existing records will NOT be overwritten. Errors can leave a partial restore; review the report and retry.'))return;
    await done('Restore research backup',async()=>{const r=await restoreBackup(db!,archive,setNotice);setArchive(null);return `Restore complete. Objects: ${r.uploadedObjects}; new records: ${Object.entries(r.inserted).filter(x=>x[1]).map(x=>`${x[0]} ${x[1]}`).join(', ')||'none'}. Existing records were not replaced.`;});
  }
  if(!allowed)return <section className="card"><h2>Private research file storage</h2><p>Sign in with an invited owner/editor account to view your private files and backup tools.</p></section>;
  return <section className="gep-files">
    <div className="heading"><div><p className="eyebrow">PRIVATE SUPABASE STORAGE</p><h1>Files & folders</h1><p>Preview research evidence, track versions, and back up actual file bytes.</p></div>
      <div className="actions"><button onClick={()=>void load().catch(e=>setError(errorMessage(e)))}><RefreshCw size={16}/> Refresh</button><button onClick={()=>void addFolder()}><FolderPlus size={16}/> Folder</button>
        <label className="button primary"><Upload size={16}/> Upload files<input type="file" multiple hidden disabled={!!busy} onChange={e=>{void upload(e.target.files);e.target.value='';}}/></label></div>
    </div>
    {busy&&<p className="notice" role="status">{busy}…</p>}{notice&&<p className="notice" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error} <button onClick={()=>setError('')}>Dismiss</button></p>}
    <input type="file" ref={replaceInput} hidden onChange={e=>{void replaceVersion(e.target.files);e.target.value='';}}/>
    <input type="file" ref={archiveInput} accept=".zip,application/zip" hidden onChange={e=>{void chooseArchive(e.target.files?.[0]);e.target.value='';}}/>
    <div className="card">
      <div className="breadcrumbs"><button onClick={()=>{setFolder('');setSearch('');}}>Root folders</button>{folder.split('/').filter(Boolean).map((part,i,a)=><React.Fragment key={i}><span>/</span><button onClick={()=>{setFolder(a.slice(0,i+1).join('/'));setSearch('');}}>{part}</button></React.Fragment>)}</div>
      <div className="foldergrid">{foldersHere.map(f=><div className="foldercard" key={f.id}>
        <button className="folder-name" onClick={()=>{setFolder(f.path);setSearch('');}}><FolderOpen size={20}/> {f.path.split('/').at(-1)}</button>
        <div className="folder-card-actions">{f.virtual?<small>Virtual parent</small>:<><button aria-label={`Rename or move ${f.path}`} onClick={()=>void editFolder(f)}>Edit</button><button aria-label={`Delete ${f.path}`} onClick={()=>void deleteFolder(f)}><Trash2 size={14}/></button></>}</div>
      </div>)}</div>
      <div className="file-title-row"><h2>Files {search?'(search results)':folder?'in '+folder:'at root'}</h2><label><input type="checkbox" checked={includeTrash} onChange={e=>setIncludeTrash(e.target.checked)}/> Show trash</label></div>
      <input className="file-search-input" placeholder="Search filename or source title across all folders" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="tablewrap"><table><thead><tr><th>File</th><th>Research purpose</th><th>Size</th><th>Version</th><th>Uploaded</th><th>Actions</th></tr></thead><tbody>
        {shownFiles.map(f=><tr key={f.id}><td><b>{f.original_name}</b><br/><small className="muted">{f.folder_path||'Root'}{f.trashed_at?' · Trash':''}</small></td><td>{f.research_role||'Other'}</td><td>{bytes(f.byte_size)}</td><td>v{f.current_version||1}</td><td>{compactDate(f.created_at)}</td><td><div className="actions file-actions">
          <button onClick={()=>setPreview({file:f})}><Eye size={14}/> Preview</button>
          <button onClick={()=>void download(f)}><Download size={14}/> Download</button>
          <button onClick={()=>setSelected(f)}><BookOpen size={14}/> Details</button>
          {!f.trashed_at&&<><button onClick={()=>{setReplaceTarget(f);replaceInput.current?.click();}}><History size={14}/> New version</button>
          <button onClick={()=>void move(f)}><FolderInput size={14}/> Move</button><button onClick={()=>void rename(f)}>Rename</button>
          <button onClick={()=>void link(f)}><Link2 size={14}/> Link</button></>}
          <button onClick={()=>void toggleTrash(f)}>{f.trashed_at?<Undo2 size={14}/>:<Trash2 size={14}/>} {f.trashed_at?'Restore':'Trash'}</button>
          {fileExtension(f.original_name)==='ipynb'&&colabUrl(f.external_url)&&<a className="button" href={colabUrl(f.external_url)!} rel="noopener noreferrer" target="_blank"><ExternalLink size={14}/> Open in Colab</a>}
        </div></td></tr>)}
        {!shownFiles.length&&<tr><td colSpan={6} className="empty">No files here. Select a folder, upload evidence or search by filename.</td></tr>}
      </tbody></table></div>
    </div>
    {role==='owner'&&<div className="card gep-backup"><h2><Archive size={19}/> Backup & restore</h2>
      <p>Full ZIP contains research records and **actual private object bytes**, including historical versions. Does not contain Supabase Auth passwords or user-role settings. Keep at least one backup away from Supabase.</p>
      <div className="actions"><button disabled={!!busy} onClick={()=>void backup()}><Download size={16}/> Full ZIP backup</button><button disabled={!!busy} onClick={()=>archiveInput.current?.click()}><FilePlus size={16}/> Open ZIP to restore</button></div>
      <small className="muted">Client-side backups/restores are capped at 250 MB uncompressed; use Supabase CLI and Storage/S3 export for larger datasets. Restore is add-only and can be partially completed if interrupted.</small>
      {archive&&<div className="restore-review"><h3>Restore preview</h3><p>{archive.manifest.objects.length} stored file objects · {bytes(archive.size)} of actual bytes · {Object.entries(archive.tables).map(([name,rows])=>`${name}: ${rows.length}`).join('; ')}</p>
        <p>No existing record ID will be overwritten. The restored files receive new private object keys; links preserve their recorded IDs.</p>
        <button className="primary" disabled={!!busy} onClick={()=>void restore()}>Restore missing records and files</button><button onClick={()=>setArchive(null)}>Cancel</button>
      </div>}
    </div>}
    <p className="muted">Research traceability: use Details for source citation, pages, assumptions, tags and version history; Link associates the file with an input, scenario, model run or task. Uploads are never automatically marked verified.</p>
    {selected&&<Metadata file={selected} versions={versions} links={links} onClose={()=>setSelected(null)} onSaved={()=>void load()}/>}
    {preview&&<FilePreview file={preview.file} versions={versions.filter(v=>v.file_id===preview.file.id)} onClose={()=>setPreview(null)} onDownload={(version)=>void download(preview.file,version)}/>}
  </section>;
}
