import {errorMessage} from './errors';
import JSZip from 'jszip';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BROWSER_ARCHIVE_LIMIT, MAX_UPLOAD, sha256 } from './fileUtils';

const TABLES = ['folders','inputs','scenarios','model_runs','tasks','sensitivities','files','file_versions','file_links','published_entries'] as const;
export type BackupTable = typeof TABLES[number];
type DataRow = Record<string, any>;
export type ArchiveManifest = {
  format: 'nepal-gep-private-backup'; schema_version: 2; created_at: string;
  includes_storage_bytes: true;
  objects: {storage_path: string; entry: string; byte_size: number; sha256: string}[];
};
export type OpenedArchive = {zip: JSZip; manifest: ArchiveManifest; tables: Record<BackupTable,DataRow[]>; size: number};
export type Progress = (message: string) => void;
const isUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw Error(message); }

async function getAll(db: SupabaseClient, table: BackupTable): Promise<DataRow[]> {
  const out: DataRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const {data,error} = await db.from(table).select('*').order('id').range(offset,offset+499);
    if (error) throw Error(`${table}: ${errorMessage(error)}`);
    out.push(...(data||[]));
    if (!data || data.length < 500) break;
  }
  return out;
}

/** Full application backup. Never includes Auth passwords, users, membership/roles, tokens or private API keys. */
export async function makeBackup(db: SupabaseClient, progress: Progress): Promise<Blob> {
  const tables = {} as Record<BackupTable,DataRow[]>;
  for (const table of TABLES) {
    tables[table] = await getAll(db,table);
    progress(`Loaded ${tables[table].length} ${table} rows`);
  }
  const byPath = new Map<string,number>();
  for (const row of [...tables.files,...tables.file_versions]) {
    if (typeof row.storage_path === 'string' && !byPath.has(row.storage_path)) byPath.set(row.storage_path,Number(row.byte_size)||0);
  }
  const total = [...byPath.values()].reduce((a,b)=>a+b,0);
  if (total > BROWSER_ARCHIVE_LIMIT) throw Error('This backup exceeds the 250 MB browser-safe limit. Use Supabase CLI/S3 plus a database export for large projects; nothing has been modified.');
  const zip = new JSZip();
  const manifest: ArchiveManifest = {format:'nepal-gep-private-backup',schema_version:2,created_at:new Date().toISOString(),includes_storage_bytes:true,objects:[]};
  let index = 0;let downloadedBytes=0;
  for (const [storagePath,expectedSize] of byPath) {
    progress(`Downloading private object ${++index}/${byPath.size}`);
    const {data,error} = await db.storage.from('research-files').download(storagePath);
    if (error || !data) throw Error(`Could not download ${storagePath}: ${error?.message || 'object missing'}. No incomplete archive was saved.`);
    if (expectedSize && data.size !== expectedSize) throw Error(`File size mismatch: ${storagePath}`);
    downloadedBytes+=data.size;
    if(downloadedBytes>BROWSER_ARCHIVE_LIMIT)throw Error('Downloaded objects exceed the 250 MB backup limit. No incomplete archive was saved.');
    const hash = await sha256(data);
    for(const row of [...tables.files,...tables.file_versions].filter(r=>r.storage_path===storagePath)){
      if(Number(row.byte_size)!==data.size||row.sha256&&row.sha256!==hash)throw Error(`Recorded integrity mismatch: ${storagePath}. No archive was saved.`);
    }
    const entry = `objects/${String(index).padStart(5,'0')}.bin`;
    zip.file(entry,new Uint8Array(await data.arrayBuffer()),{binary:true});
    manifest.objects.push({storage_path:storagePath,entry,byte_size:data.size,sha256:hash});
  }
  for(const table of TABLES){
    if(JSON.stringify(await getAll(db,table))!==JSON.stringify(tables[table]))throw Error('Research records changed during backup. Pause edits and retry; no incomplete archive was saved.');
  }
  zip.file('records.json',JSON.stringify({schema_version:2,tables},null,2));
  zip.file('manifest.json',JSON.stringify(manifest,null,2));
  progress('Compressing archive with all recorded file versions');
  const archive = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
  progress(`Backup created: ${archive.size} bytes. Store at least one copy outside Supabase.`);
  return archive;
}

export async function openBackup(file: File, progress: Progress): Promise<OpenedArchive> {
  if(file.size > BROWSER_ARCHIVE_LIMIT) throw Error('ZIP exceeds the 250 MB browser-safe restore limit.');
  // Inspect declared expansion sizes before decompressing any entry; validate actual file bytes with SHA-256 below.
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  assert(Object.keys(zip.files).length<=25000,'Too many archive entries');
  assert(Object.values(zip.files).reduce((n,f)=>n+((f as any)._data?.uncompressedSize||0),0)<=BROWSER_ARCHIVE_LIMIT+32*1024*1024,'Archive expansion exceeds safe limit');
  const manifestEntry=zip.file('manifest.json'); const recordsEntry=zip.file('records.json');
  if(!manifestEntry||!recordsEntry) throw Error('Archive missing manifest.json or records.json');
  if (((manifestEntry as any)._data?.uncompressedSize || 0) > 2*1024*1024 || ((recordsEntry as any)._data?.uncompressedSize || 0) > 30*1024*1024) throw Error('Backup metadata is too large for safe browser restore');
  const manifest=JSON.parse(await manifestEntry.async('text')) as ArchiveManifest;
  const records=JSON.parse(await recordsEntry.async('text')) as {schema_version:number; tables:Record<BackupTable,DataRow[]>};
  assert(manifest.format==='nepal-gep-private-backup' && manifest.schema_version===2 && manifest.includes_storage_bytes===true,'Not a supported full Nepal GEP backup');
  assert(records.schema_version===2 && records.tables && typeof records.tables==='object','Invalid research records manifest');
  assert(Array.isArray(manifest.objects) && manifest.objects.length <= 20000,'Invalid object list');
  for(const table of TABLES){
    assert(Array.isArray(records.tables[table]) && records.tables[table].length<=100000,`Missing or oversized table: ${table}`);
    assert(new Set(records.tables[table].map(r=>r?.id)).size===records.tables[table].length,`Duplicate row IDs in ${table}`);
    for(const row of records.tables[table]) assert(row && typeof row==='object' && isUuid(row.id),`Invalid row identifier in ${table}`);
  }
  const paths=new Set<string>();const objectKeys=new Set<string>();let combined=0;
  for(const obj of manifest.objects){
    assert(!objectKeys.has(obj.storage_path),'Duplicate storage object key');objectKeys.add(obj.storage_path);
    assert(typeof obj.storage_path==='string' && /^objects\/[0-9a-f-]{36}$/i.test(obj.storage_path),'Invalid storage object key');
    assert(/^objects\/[0-9]{5}\.bin$/.test(obj.entry) && !paths.has(obj.entry) && Boolean(zip.file(obj.entry)),'Missing or duplicated object archive entry');
    assert(Number.isInteger(obj.byte_size) && obj.byte_size>=0 && obj.byte_size<=MAX_UPLOAD, 'Invalid object byte size');
    assert(((zip.file(obj.entry) as any)?._data?.uncompressedSize ?? obj.byte_size) <= MAX_UPLOAD,'Oversized archive object rejected');
    assert(/^[a-f0-9]{64}$/.test(obj.sha256), 'Invalid object checksum');
    combined+=obj.byte_size;paths.add(obj.entry);
  }
  assert(combined<=BROWSER_ARCHIVE_LIMIT,'Backup exceeds 250 MB browser restore limit');
  const keys=new Set(manifest.objects.map(o=>o.storage_path));
  for(const row of [...records.tables.files,...records.tables.file_versions]) {
    assert(keys.has(row.storage_path),'Backup is missing a referenced file object');
    const obj=manifest.objects.find(o=>o.storage_path===row.storage_path)!;
    assert(Number(row.byte_size)===obj.byte_size,'Recorded file size differs from object manifest');
    assert(!row.sha256||row.sha256===obj.sha256,'Recorded file checksum differs from object manifest');
  }
  for(const row of records.tables.folders)assert(typeof row.path==='string'&&row.path.length>0&&!/(^\/|\.\.|\/\/|\\)/.test(row.path),'Invalid folder path');
  const pairs=new Set<string>();
  for(const row of records.tables.file_versions){
    const pair=`${row.file_id}:${row.version_number}`;
    assert(!pairs.has(pair)&&Number.isInteger(row.version_number)&&row.version_number>0,'Invalid or duplicate version number');pairs.add(pair);
    assert(records.tables.files.some(f=>f.id===row.file_id),'Version has no parent file');
  }
  for(const row of records.tables.tasks)assert(!row.parent_id||records.tables.tasks.some(t=>t.id===row.parent_id),'Task parent missing');
  for(const row of records.tables.sensitivities)assert(!row.baseline_run_id||records.tables.model_runs.some(r=>r.id===row.baseline_run_id),'Baseline run missing');
  for(const row of records.tables.file_links)assert(records.tables.files.some(f=>f.id===row.file_id)&&['inputs','scenarios','model_runs','tasks','sensitivities'].includes(row.record_type)&&records.tables[row.record_type as BackupTable].some(r=>r.id===row.record_id),'Research link target missing');
  progress(`Archive opened: ${TABLES.map(t=>`${t} ${records.tables[t].length}`).join(', ')}; ${manifest.objects.length} verified-manifest objects`);
  // Check all bytes BEFORE any DB or Storage writes.
  for(let i=0;i<manifest.objects.length;i++){
    const obj=manifest.objects[i];const content=await zip.file(obj.entry)!.async('uint8array');
    const data=new Blob([Uint8Array.from(content)]);
    assert(data.size===obj.byte_size && await sha256(data)===obj.sha256,`Checksum mismatch in ${obj.entry}`);
    if((i+1)%5===0 || i===manifest.objects.length-1) progress(`Checked ${i+1}/${manifest.objects.length} archived objects`);
  }
  return {zip,manifest,tables:records.tables,size:combined};
}

type ImportOutcome = {inserted:Record<string,number>;skipped:Record<string,number>;uploadedObjects:number};
/** Add-only import. Preserves already-existing IDs and all original files. Not a database transaction:
 * errors report partial progress, making a retry possible (existing IDs are skipped). */
export async function restoreBackup(db: SupabaseClient, archive:OpenedArchive, progress:Progress):Promise<ImportOutcome>{
  const inserted:Record<string,number>={},skipped:Record<string,number>={};
  for(const table of TABLES){inserted[table]=0;skipped[table]=0;}
  const present = {} as Record<BackupTable,Map<string,DataRow>>;
  for(const table of TABLES){
    present[table]=new Map((await getAll(db,table)).map(r=>[r.id,r]));
  }
  // Stop on ambiguity before uploading bytes or inserting rows. Existing IDs are never overwritten.
  for(const table of TABLES)for(const row of archive.tables[table]){
    const existing=present[table].get(row.id);
    if(existing){
      const ignored=new Set(['updated_at',...(table==='files'||table==='file_versions'?['storage_path']:[])]);
      const canonical=(v:any):string=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
      for(const key of Object.keys(row))if(!ignored.has(key)&&canonical(row[key])!==canonical(existing[key]))
        throw Error(`Restore conflict in ${table}, ID ${row.id}, field ${key}. Nothing was written. Use a separate recovery project.`);
    }
    if(table==='folders'&&[...present.folders.values()].some(r=>r.path===row.path&&r.id!==row.id))throw Error(`Folder path conflict: ${row.path}. Nothing was written.`);
    if(table==='scenarios'&&[...present.scenarios.values()].some(r=>r.horizon===row.horizon&&r.id!==row.id))throw Error(`Scenario horizon conflict: ${row.horizon}. Nothing was written.`);
    if(table==='file_versions'&&[...present.file_versions.values()].some(r=>r.file_id===row.file_id&&r.version_number===row.version_number&&r.id!==row.id&&r.sha256!==row.sha256))throw Error(`Version conflict: ${row.file_id} v${row.version_number}. Nothing was written.`);
  }
  // Confirm that skipped private file records actually have the archived bytes, even for legacy rows without digests.
  for(const table of ['files','file_versions'] as const)for(const row of archive.tables[table]){
    const existing=present[table].get(row.id)||(table==='file_versions'?[...present.file_versions.values()].find(v=>v.file_id===row.file_id&&v.version_number===row.version_number):undefined);if(!existing)continue;
    if(table==='file_versions'&&['original_name','byte_size','mime_type','notes'].some(key=>(existing[key]??null)!==(row[key]??null)))throw Error(`Version metadata conflict: ${row.file_id} v${row.version_number}. Nothing was written.`);
    const expected=archive.manifest.objects.find(o=>o.storage_path===row.storage_path)!;
    const result=await db.storage.from('research-files').download(existing.storage_path);
    if(result.error||!result.data||await sha256(result.data)!==expected.sha256)throw Error(`Existing object differs or is missing for ${table} ${row.id}. Nothing was written; recover in a separate project.`);
  }
  let uploadedObjects=0;
  try {
  const insert = async (table:BackupTable,row:DataRow) => {
    const {error}=await db.from(table).insert(row);
    if(error) throw Error(`${table}, ID ${row.id}: ${errorMessage(error)}`);
    inserted[table]++;present[table].set(row.id,row);
  };
  // Folder paths are globally unique, even when IDs differ.
  const existingPaths = new Set([...present.folders.values()].map(r=>r.path));
  for(const row of [...archive.tables.folders].sort((a,b)=>a.path.length-b.path.length)){
    if(present.folders.has(row.id)||existingPaths.has(row.path)){skipped.folders++;continue;}
    await insert('folders',row);existingPaths.add(row.path);
  }
  for(const table of ['inputs','scenarios','model_runs'] as const){
    for(const row of archive.tables[table]){
      if(present[table].has(row.id) || (table==='scenarios' && [...present.scenarios.values()].some(s=>s.horizon===row.horizon))){skipped[table]++;continue;}
      await insert(table,row);
    }
  }
  // Tasks may have parent foreign keys: insert them without parent references first.
  const newTaskParents: {id:string;parent_id:string}[]=[];
  for(const row of archive.tables.tasks){
    if(present.tasks.has(row.id)){skipped.tasks++;continue;}
    if(row.parent_id) newTaskParents.push({id:row.id,parent_id:row.parent_id});
    await insert('tasks',{...row,parent_id:null});
  }
  for(const {id,parent_id} of newTaskParents){
    if(present.tasks.has(parent_id)){
      const {error}=await db.from('tasks').update({parent_id}).eq('id',id);
      if(error) throw Error(`Task parent ${id}: ${errorMessage(error)}`);
    }
  }
  for(const row of archive.tables.sensitivities){
    if(present.sensitivities.has(row.id)){skipped.sensitivities++;continue;}
    if(row.baseline_run_id && !present.model_runs.has(row.baseline_run_id)) throw Error(`Missing baseline run ${row.baseline_run_id}`);
    await insert('sensitivities',row);
  }
  const neededFiles=archive.tables.files.filter(r=>!present.files.has(r.id));
  skipped.files=archive.tables.files.length-neededFiles.length;
  const neededIds=new Set(neededFiles.map(r=>r.id));
  const currentPairs=new Set([...present.file_versions.values()].map(v=>`${v.file_id}:${v.version_number}`));
  const neededHistory=archive.tables.file_versions.filter(v=>
    !present.file_versions.has(v.id) && !currentPairs.has(`${v.file_id}:${v.version_number}`)
    && (neededIds.has(v.file_id) || present.files.has(v.file_id)));
  const neededOldPaths=new Set<string>(neededFiles.map(r=>r.storage_path));
  for(const v of neededHistory) neededOldPaths.add(v.storage_path);
  const mimeByPath=new Map<string,string>();
  for(const r of [...archive.tables.files,...archive.tables.file_versions])
    if(r.storage_path && r.mime_type) mimeByPath.set(r.storage_path,r.mime_type);
  const objectMap=new Map<string,string>();
  for(const oldPath of neededOldPaths){
    const m=archive.manifest.objects.find(o=>o.storage_path===oldPath);
    if(!m) throw Error(`Missing object ${oldPath}`);
    const newPath=`objects/${crypto.randomUUID()}`;
    const content=await archive.zip.file(m.entry)!.async('uint8array');
    const data=new Blob([Uint8Array.from(content)]);
    const {error}=await db.storage.from('research-files').upload(newPath,data,{upsert:false,contentType:mimeByPath.get(oldPath)||'application/octet-stream'});
    if(error) throw Error(`Restore upload stopped at ${oldPath}: ${errorMessage(error)}. Earlier uploads/rows may remain; rerun safely to skip restored IDs.`);
    const verified=await db.storage.from('research-files').download(newPath);
    if(verified.error||!verified.data||await sha256(verified.data)!==m.sha256)throw Error(`Uploaded object verification failed: ${newPath}. Preserve this recovery key and retry after investigating.`);
    objectMap.set(oldPath,newPath);
    progress(`Restored ${++uploadedObjects}/${neededOldPaths.size} private file objects`);
  }
  for(const row of neededFiles) await insert('files',{...row,storage_path:objectMap.get(row.storage_path)});
  // File-insert trigger may have already populated v1; a restored copy does not overwrite it.
  const versionsAfterInsert = await getAll(db,'file_versions');
  const pairsAfterInsert=new Set(versionsAfterInsert.map(v=>`${v.file_id}:${v.version_number}`));
  for(const row of archive.tables.file_versions){
    if(present.file_versions.has(row.id) || pairsAfterInsert.has(`${row.file_id}:${row.version_number}`)){
      skipped.file_versions++;continue;
    }
    if(!present.files.has(row.file_id)){skipped.file_versions++;continue;}
    const mapped=objectMap.get(row.storage_path);
    if(!mapped)throw Error(`Cannot restore version ${row.file_id} v${row.version_number}: missing object mapping`);
    await insert('file_versions',{...row,storage_path:mapped});
    pairsAfterInsert.add(`${row.file_id}:${row.version_number}`);
  }
  for(const table of ['file_links','published_entries'] as const){
    for(const row of archive.tables[table]){
      if(present[table].has(row.id)){skipped[table]++;continue;}
      if(table==='file_links' && !present.files.has(row.file_id)){skipped[table]++;continue;}
      await insert(table,row);
    }
  }
  progress('Restore finished. Existing data was not overwritten. Verify restored file downloads and records.');
  return {inserted,skipped,uploadedObjects};
  } catch(error) {
    throw Error(`${errorMessage(error)} Restore stopped: ${JSON.stringify(inserted)} inserted; ${uploadedObjects} verified objects uploaded. Earlier inserts and fresh recovery objects are retained. Save this report and the original ZIP; do not delete existing data. Retry may require a separate recovery project.`);
  }
}
