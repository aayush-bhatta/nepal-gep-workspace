import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string|undefined;
export const configured=Boolean(url&&key&&url.startsWith('https://')&&!url.includes('YOUR_')&&!key?.includes('YOUR_'));
export const db=configured?createClient(url!,key!):null;
export const bucket='research-files';
export function ensure<T>(data:T,error:{message:string}|null):T{if(error)throw new Error(error.message);return data;}
export async function rows(table:string){if(!db)return [];const {data,error}=await db.from(table).select('*').order(table==='published_entries'?'published_at':'created_at',{ascending:false});return ensure(data||[],error);}
export async function save(table:string,value:Record<string,unknown>){if(!db)throw Error('Supabase not configured');const {data,error}=value.id?await db.from(table).update(value).eq('id',value.id).select().single():await db.from(table).insert(value).select().single();return ensure(data,error);}
export async function remove(table:string,id:string){if(!db)throw Error('Supabase not configured');const {error}=await db.from(table).delete().eq('id',id);ensure(null,error);}
export function downloadBlob(content:Blob,name:string){const url=URL.createObjectURL(content);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function exportJson(value:unknown,name:string){downloadBlob(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),name);}
export function csv(values:Record<string,unknown>[]){if(!values.length)return '';const keys=[...new Set(values.flatMap(Object.keys))];const esc=(v:unknown)=>'"'+String(v==null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';return [keys.join(','),...values.map(v=>keys.map(k=>esc(v[k])).join(','))].join('\r\n');}
