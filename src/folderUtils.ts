type Folder = {id:string;[key:string]:any};
/** Materialize virtual parents without writing to Supabase. Legacy paths remain reachable. */
export function visibleFolders(folders:Folder[], files:{[key:string]:any}[]):Folder[] {
  const paths=new Map(folders.map(f=>[f.path,f]));
  for(const path of [...folders.map(f=>f.path),...files.map(f=>f.folder_path||'')]) {
    const parts=path.split('/').filter(Boolean);
    for(let i=1;i<=parts.length;i++) {
      const parent=parts.slice(0,i).join('/');
      if(!paths.has(parent))paths.set(parent,{id:`virtual:${parent}`,path:parent,virtual:true});
    }
  }
  return [...paths.values()];
}
export function folderOccupied(path:string,folders:Folder[],files:{[key:string]:any}[]):boolean {
  return folders.some(f=>f.path.startsWith(path+'/'))||files.some(f=>f.folder_path===path||f.folder_path.startsWith(path+'/'));
}
