import React,{useEffect,useState} from 'react';
import {Download,ExternalLink} from 'lucide-react';
import {db,bucket} from './db';
import {fileExtension,bytes,colabUrl,parseCsv,previewXlsx,xlsxSheetNames,type PreviewGrid} from './fileUtils';

type Row={id:string;[key:string]:any};
type Rendered = {kind:'pdf'|'image'|'table'|'text'|'notebook'|'unsupported';url?:string;grid?:PreviewGrid;text?:string;note?:string;cells?:{cell_type:string;source:string}[];sheets?:string[]};
const allowedText = new Set(['py','txt','md','json','yaml','yml','toml','sql','log','tex','r','m','ipynb']);
export function FilePreview({file,versions,onClose,onDownload}:{file:Row;versions:Row[];onClose:()=>void;onDownload:(version?:Row)=>void}){
  const [versionId,setVersionId]=useState('current');
  const [sheet,setSheet]=useState<string>('');
  const [blob,setBlob]=useState<Blob|null>(null);
  const [view,setView]=useState<Rendered|null>(null);
  const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const chosenVersion=versions.find(v=>v.id===versionId);
  const target=chosenVersion||file;
  const name=target.original_name as string;
  useEffect(()=>{
    let active=true;let objectUrl:string|undefined;
    const run=async()=>{
      if(!db)return;setLoading(true);setView(null);setError('');setBlob(null);setSheet('');
      const {data,error}=await db.storage.from(bucket).download(target.storage_path);
      if(!active)return;
      if(error||!data){setError(`File could not be opened: ${error?.message||'object missing'}`);setLoading(false);return;}
      setBlob(data);
      const ext=fileExtension(name);
      try{
        if(ext==='pdf'){
          objectUrl=URL.createObjectURL(new Blob([data],{type:'application/pdf'}));setView({kind:'pdf',url:objectUrl,note:'Local browser PDF preview. File remains in private storage.'});
        }else if(['png','jpeg','jpg','gif','webp','bmp','svg'].includes(ext)){
          if(ext==='svg'){setView({kind:'unsupported',note:'SVG can contain active content, so it is not embedded. Download to inspect safely.'});}
          else{objectUrl=URL.createObjectURL(data);setView({kind:'image',url:objectUrl});}
        }else if(ext==='csv'){
          if(data.size>12*1024*1024)throw Error('CSV preview capped at 12 MB; download for larger analysis');
          setView({kind:'table',grid:parseCsv(await data.text())});
        }else if(ext==='xlsx'){
          const sheets=await xlsxSheetNames(data);setView({kind:'table',grid:await previewXlsx(data,sheets[0]),sheets});
          setSheet(sheets[0]||'');
        }else if(ext==='xls'){
          setView({kind:'unsupported',note:'Legacy .xls files are not supported by the safe viewer. Convert to .xlsx or CSV for preview.'});
        }else if(ext==='ipynb'){
          if(data.size>5*1024*1024)throw Error('Notebook too large for browser preview');
          const raw=JSON.parse(await data.text());
          const cells=(Array.isArray(raw.cells)?raw.cells:[]).slice(0,150).map((c:any)=>({cell_type:String(c.cell_type||'code'),source:Array.isArray(c.source)?c.source.join(''):String(c.source||'')}));
          setView({kind:'notebook',cells,note:'Notebook source only. Outputs are not executed; private Supabase notebooks must be uploaded to Colab or linked from Drive.'});
        }else if(allowedText.has(ext)){
          if(data.size>4*1024*1024)throw Error('Code/text preview capped at 4 MB');
          setView({kind:'text',text:(await data.text()).slice(0,250000),note:'Text-only preview: file contents are never executed.'});
        }else{
          setView({kind:'unsupported',note:'No in-browser viewer for this format. Keep it private and download it when needed.'});
        }
      }catch(e){if(active)setError(String(e));}
      if(active)setLoading(false);
    };
    void run();
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[target.storage_path,name]);
  async function changeSheet(next:string){
    if(!blob)return;setSheet(next);setLoading(true);setError('');
    try{setView(v=>({...v,kind:'table',grid:undefined} as Rendered));const grid=await previewXlsx(blob,next);setView(v=>({...v,kind:'table',grid} as Rendered));}
    catch(e){setError(String(e));}finally{setLoading(false);}
  }
  const colab=colabUrl(file.external_url);
  return <div className="overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="modal file-modal preview-modal" role="dialog" aria-modal="true" aria-label="Private file preview">
      <header><div><h2>{file.original_name}</h2><small className="muted">Private preview · {bytes(target.byte_size)} · source unchanged</small></div><button onClick={onClose}>Close</button></header>
      <div className="preview-toolbar">
        <label>Version <select value={versionId} onChange={e=>setVersionId(e.target.value)}><option value="current">Current v{file.current_version||1}</option>{[...versions].sort((a,b)=>b.version_number-a.version_number).filter(v=>v.version_number!==file.current_version).map(v=><option key={v.id} value={v.id}>v{v.version_number} — {v.original_name}</option>)}</select></label>
        <button onClick={()=>onDownload(chosenVersion)}><Download size={15}/> Download this version</button>
        {fileExtension(file.original_name)==='ipynb'&&<>{colab?<a className="button" target="_blank" rel="noreferrer noopener" href={colab}><ExternalLink size={15}/> Open linked Colab notebook</a>:
          <button onClick={()=>{onDownload(chosenVersion);window.open('https://colab.research.google.com/','_blank','noopener,noreferrer');}}>Download notebook + open Colab</button>}</>}
        {view?.sheets&&view.sheets.length>1&&<label>Worksheet <select value={sheet} onChange={e=>void changeSheet(e.target.value)}>{view.sheets.map(s=><option key={s}>{s}</option>)}</select></label>}
      </div>
      {loading&&<p role="status">Loading private file preview…</p>}
      {error&&<p className="error" role="alert">{error}</p>}
      {!loading&&view&&<div className="preview-body">
        {view.kind==='pdf'&&<><p className="muted">{view.note}</p><iframe title={`PDF preview: ${name}`} className="pdf-preview" sandbox="allow-same-origin" src={view.url}/><a target="_blank" rel="noreferrer" href={view.url}>Open PDF in separate browser tab</a></>}
        {view.kind==='image'&&<img alt={`Preview of ${name}`} className="image-preview" src={view.url}/>}
        {view.kind==='table'&&view.grid&&<><p className="muted">{view.grid.note}</p><h3>{view.grid.title}</h3><div className="tablewrap csv-preview"><table><thead><tr>{view.grid.columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody>{view.grid.rows.map((r,i)=><tr key={i}>{view.grid!.columns.map((_,j)=><td key={j}>{r[j]||''}</td>)}</tr>)}</tbody></table></div></>}
        {view.kind==='text'&&<><p className="muted">{view.note}</p><pre className="code-preview">{view.text}</pre></>}
        {view.kind==='notebook'&&<><p className="muted">{view.note}</p>{view.cells?.map((c,i)=><div className="notebook-cell" key={i}><small>{i+1} · {c.cell_type}</small><pre>{c.source.slice(0,16000)}</pre></div>)}</>}
        {view.kind==='unsupported'&&<p>{view.note}</p>}
      </div>}
    </section>
  </div>;
}
