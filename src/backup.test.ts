import {describe,it,expect,vi} from 'vitest';
import JSZip from 'jszip';
import {makeBackup,openBackup,restoreBackup} from './backup';
import {sha256} from './fileUtils';
const id='11111111-1111-4111-8111-111111111111';
const path=`objects/${id}`;
const tables=()=>Object.fromEntries(['folders','inputs','scenarios','model_runs','tasks','sensitivities','files','file_versions','file_links','published_entries'].map(t=>[t,[]])) as Record<string,any[]>;
async function fixture(){
 const data=new Blob(['private research bytes']);const hash=await sha256(data);const t=tables();
 t.files=[{id,storage_path:path,original_name:'demand.csv',folder_path:'',byte_size:data.size,sha256:hash,current_version:1}];
 return {data,hash,t};
}
function client(t:Record<string,any[]>,data:Blob){
 const insert=vi.fn(async(..._args:any[])=>({error:null}));const upload=vi.fn(async(..._args:any[])=>({error:null}));
 const download=vi.fn(async(..._args:any[])=>({data,error:null}));
 const db={from:(table:string)=>({select:()=>({order:()=>({range:async()=>({data:t[table],error:null})})}),insert,update:()=>({eq:async()=>({error:null})})}),storage:{from:()=>({download,upload})}};
 return {db:db as any,insert,upload,download};
}
async function open(blob:Blob){return openBackup(new File([blob],'backup.zip'),()=>{});}
async function edit(blob:Blob,change:(zip:JSZip)=>Promise<void>){const z=await JSZip.loadAsync(await blob.arrayBuffer());await change(z);return z.generateAsync({type:'blob'});}
describe('private ZIP integrity and restore safeguards',()=>{
 it('round trips actual private bytes and rejects changed payloads before any writes',async()=>{
  const {t,data}=await fixture();const {db}=client(t,data);const zip=await makeBackup(db,()=>{});const archive=await open(zip);
  expect(await archive.zip.file(archive.manifest.objects[0].entry)!.async('text')).toBe('private research bytes');
  const corrupt=await edit(zip,async z=>{z.file('objects/00001.bin','modified');});
  await expect(open(corrupt)).rejects.toThrow('Checksum mismatch');
 });
 it('rejects duplicate storage keys, duplicate IDs and inconsistent recorded digests',async()=>{
  const {t,data}=await fixture();const zip=await makeBackup(client(t,data).db,()=>{});
  const duplicate=await edit(zip,async z=>{const m=JSON.parse(await z.file('manifest.json')!.async('text'));m.objects.push({...m.objects[0],entry:'objects/00002.bin'});z.file('objects/00002.bin','private research bytes');z.file('manifest.json',JSON.stringify(m));});
  await expect(open(duplicate)).rejects.toThrow('Duplicate storage object key');
  const ids=await edit(zip,async z=>{const r=JSON.parse(await z.file('records.json')!.async('text'));r.tables.files.push(r.tables.files[0]);z.file('records.json',JSON.stringify(r));});
  await expect(open(ids)).rejects.toThrow('Duplicate row IDs');
  t.files[0].sha256='0'.repeat(64);await expect(makeBackup(client(t,data).db,()=>{})).rejects.toThrow('integrity mismatch');
 });
 it('stops conflicting existing IDs before writes and verifies skipped bytes',async()=>{
  const {t,data}=await fixture();const archive=await open(await makeBackup(client(t,data).db,()=>{}));
  const existing=structuredClone(t);existing.files[0].original_name='changed.csv';
  const mock=client(existing,data);await expect(restoreBackup(mock.db,archive,()=>{})).rejects.toThrow('Restore conflict');
  expect(mock.insert).not.toHaveBeenCalled();expect(mock.upload).not.toHaveBeenCalled();
  const missing=client(t,new Blob(['wrong']));await expect(restoreBackup(missing.db,archive,()=>{})).rejects.toThrow('Existing object differs');expect(missing.insert).not.toHaveBeenCalled();
 });
 it('restores into fresh keys with upsert disabled and reports partial failures',async()=>{
  const {t,data}=await fixture();const archive=await open(await makeBackup(client(t,data).db,()=>{}));const mock=client(tables(),data);
  const result=await restoreBackup(mock.db,archive,()=>{});expect(result.inserted.files).toBe(1);
  expect(mock.upload.mock.calls[0][0]).not.toBe(path);expect((mock.upload.mock.calls as any)[0][2].upsert).toBe(false);
  const broken=client(tables(),data);broken.insert.mockResolvedValue({error:{message:'constraint failure'}} as any);
  await expect(restoreBackup(broken.db,archive,()=>{})).rejects.toThrow('Earlier inserts and fresh recovery objects are retained');
 });
 it('retains distinct current and historical private version bytes in a fresh restore',async()=>{
  const {t,data,hash}=await fixture();const old=new Blob(['earlier version']);const oldHash=await sha256(old);const oldPath='objects/22222222-2222-4222-8222-222222222222';
  t.files[0].current_version=2;
  t.file_versions=[{id:'33333333-3333-4333-8333-333333333333',file_id:id,version_number:1,storage_path:oldPath,original_name:'old.csv',byte_size:old.size,sha256:oldHash},{id:'44444444-4444-4444-8444-444444444444',file_id:id,version_number:2,storage_path:path,original_name:'demand.csv',byte_size:data.size,sha256:hash}];
  const source=client(t,data);source.download.mockImplementation(async(key:string)=>({data:key===oldPath?old:data,error:null}));
  const archive=await open(await makeBackup(source.db,()=>{}));expect(archive.manifest.objects).toHaveLength(2);
  const target=client(tables(),data);const stored=new Map<string,Blob>();
  target.upload.mockImplementation(async(key:string,value:Blob)=>{stored.set(key,value);return {error:null};});target.download.mockImplementation(async(key:string)=>({data:stored.get(key)!,error:null}));
  const outcome=await restoreBackup(target.db,archive,()=>{});expect(outcome.inserted.file_versions).toBe(2);expect([...await Promise.all([...stored.values()].map(v=>v.text()))].sort()).toEqual(['earlier version','private research bytes']);
 });

});
