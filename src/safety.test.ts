import {readAll} from './dataAccess';
import {describe,it,expect} from 'vitest';
import {errorMessage} from './errors';
import {visibleFolders,folderOccupied} from './folderUtils';
describe('errors and folder navigation',()=>{
  it('formats Supabase plain object errors with actionable details',()=>{
    expect(errorMessage({message:'Permission denied',details:'Owner required',hint:'Sign in',code:'42501'})).toBe('Permission denied · Owner required · Sign in · 42501');
    expect(errorMessage(new Error('Network failed'))).toBe('Network failed');
    expect(errorMessage({})).not.toContain('[object Object]');
  });
  it('materializes absent ancestors and folders referenced only by files',()=>{
    const result=visibleFolders([{id:'1',path:'Data/Demand'}],[{folder_path:'Models/Python'}]);
    expect(result.map(f=>f.path).sort()).toEqual(['Data','Data/Demand','Models','Models/Python']);
    expect(result.find(f=>f.path==='Data')?.virtual).toBe(true);
  });
  it('blocks deletion for subfolders and trashed file references without confusing path prefixes',()=>{
    expect(folderOccupied('Data',[],[{folder_path:'Data',trashed_at:'today'}])).toBe(true);
    expect(folderOccupied('Data',[{id:'1',path:'Data/Demand'}],[])).toBe(true);
    expect(folderOccupied('Data',[],[{folder_path:'Database'}])).toBe(false);
  });
});

it('loads folders, files and history beyond API caps',async()=>{
 const records=Array.from({length:2501},(_,id)=>({id}));const requested:number[]=[];
 const client={from:()=>({select:()=>({order:()=>({range:async(start:number,end:number)=>{requested.push(start);return {data:records.slice(start,end+1),error:null};}})})})};
 expect(await readAll(client,'files')).toHaveLength(2501);
 expect(requested).toEqual([0,500,1000,1500,2000,2500]);
});
