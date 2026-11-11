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
    if (error) throw Error(`${table}: ${error.message}`);
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
  let index = 0;
  for (const [storagePath,expectedSize] of byPath) {
    progress(`Downloading private object ${++index}/${byPath.size}`);
    const {data,error} = await db.storage.from('research-files').download(storagePath);
    if (error || !data) throw Error(`Could not download ${storagePath}: ${error?.message || 'object missing'}. No incomplete archive was saved.`);
    if (expectedSize && data.size !== expectedSize) throw Error(`File size mismatch: ${storagePath}`);
    const hash = await sha256(data);
    const entry = `objects/${String(index).padStart(5,'0')}.bin`;
    zip.file(entry,new Uint8Array(await data.arrayBuffer()),{binary:true});
    manifest.objects.push({storage_path:storagePath,entry,byte_size:data.size,sha256:hash});
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
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
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
    for(const row of records.tables[table]) assert(row && typeof row==='object' && isUuid(row.id),`Invalid row identifier in ${table}`);
  }
  const paths=new Set<string>();let combined=0;
  for(const obj of manifest.objects){
    assert(typeof obj.storage_path==='string' && /^objects\/[0-9a-f-]{36}$/i.test(obj.storage_path),'Invalid storage object key');
    assert(/^objects\/[0-9]{5}\.bin$/.test(obj.entry) && !paths.has(obj.entry) && Boolean(zip.file(obj.entry)),'Missing or duplicated object archive entry');
    assert(Number.isInteger(obj.byte_size) && obj.byte_size>=0 && obj.byte_size<=MAX_UPLOAD, 'Invalid object byte size');
    assert(((zip.file(obj.entry) as any)?._data?.uncompressedSize ?? obj.byte_size) <= MAX_UPLOAD,'Oversized archive object rejected');
    assert(/^[a-f0-9]{64}$/.test(obj.sha256), 'Invalid object checksum');
    combined+=obj.byte_size;paths.add(obj.entry);
  }
  assert(combined<=BROWSER_ARCHIVE_LIMIT,'Backup exceeds 250 MB browser restore limit');
  const keys=new Set(manifest.objects.map(o=>o.storage_path));
  for(const row of [...records.tables.files,...records.tables.file_versions]) assert(keys.has(row.storage_path),'Backup is missing a referenced file object');
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
  const insert = async (table:BackupTable,row:DataRow) => {
    const {error}=await db.from(table).insert(row);
    if(error) throw Error(`${table}, ID ${row.id}: ${error.message}`);
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
      if(error) throw Error(`Task parent ${id}: ${error.message}`);
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
  let uploadedObjects=0;
  for(const oldPath of neededOldPaths){
    const m=archive.manifest.objects.find(o=>o.storage_path===oldPath);
    if(!m) throw Error(`Missing object ${oldPath}`);
    const newPath=`objects/${crypto.randomUUID()}`;
    const content=await archive.zip.file(m.entry)!.async('uint8array');
    const data=new Blob([Uint8Array.from(content)]);
    const {error}=await db.storage.from('research-files').upload(newPath,data,{upsert:false,contentType:mimeByPath.get(oldPath)||'application/octet-stream'});
    if(error) throw Error(`Restore upload stopped at ${oldPath}: ${error.message}. Earlier uploads/rows may remain; rerun safely to skip restored IDs.`);
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
}
