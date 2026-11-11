export type ResearchTask = {id:string;title:string;parent_id?:string|null};
export function parentTaskOptions(tasks:ResearchTask[],editingId?:string|null):ResearchTask[]{
 const blocked=new Set<string>(editingId?[editingId]:[]);
 // A task cannot become a child of itself or any of its descendants.
 let changed=true;
 while(changed){
  changed=false;
  for(const task of tasks){
   if(task.parent_id && blocked.has(task.parent_id) && !blocked.has(task.id)){
    blocked.add(task.id);changed=true;
   }
  }
 }
 return tasks.filter(task=>!blocked.has(task.id)).sort((a,b)=>a.title.localeCompare(b.title));
}
export function parseResearchJson(key:string,value:unknown):unknown{
 if(value===null||value===undefined||value==='')return null;
 let v=value;
 if(typeof value==='string'){
  try {v=JSON.parse(value);}catch{
   throw Error(`${key.replaceAll('_',' ')} requires valid JSON, for example {"note":"Summary"} or {"cost_change":1200}. Use Evidence for free-form notes.`);
  }
 }
 if(v===null||Array.isArray(v)||typeof v!=='object'){
  throw Error(`${key.replaceAll('_',' ')} requires a JSON object, e.g. {"note":"Summary"}.`);
 }
 return v;
}
export function researchJsonMessage(key:string,value:unknown):string{
 try{parseResearchJson(key,value);return '';}catch(e){return e instanceof Error?e.message:String(e);}
}
export function confirmFileTrash(name:string):string{
 return `Move "${name}" to Trash?\n\nThe file disappears from public research lists but can be restored from Trash. Its previous versions and research citations remain recorded.`;
}
export function confirmRecordRemoval(entity:string,title:string,children=0):string{
 return `Delete ${entity} "${title}"?\n\nThis removes the database record. ${children?`${children} child task(s) will become top-level.\n\n`:''}The activity log will retain the deletion event; a full record restore requires a backup.`;
}
