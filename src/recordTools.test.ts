import {describe,it,expect} from 'vitest';
import {parentTaskOptions,parseResearchJson,researchJsonMessage,confirmFileTrash,confirmRecordRemoval} from './recordTools';
describe('safe research editors and confirmations',()=>{
 const tasks=[
  {id:'a',title:'Data',parent_id:null},
  {id:'b',title:'Demand',parent_id:'a'},
  {id:'c',title:'Profile',parent_id:'b'},
  {id:'d',title:'Reports',parent_id:null}
 ];
 it('prevents selecting self or descendant as task parent',()=>{
  expect(parentTaskOptions(tasks,'a').map(x=>x.id)).toEqual(['d']);
  expect(parentTaskOptions(tasks,'b').map(x=>x.id).sort()).toEqual(['a','d']);
  expect(parentTaskOptions(tasks).length).toBe(4);
 });
 it('accepts only well-formed JSON objects',()=>{
  expect(parseResearchJson('results','{"cost_change":1200}')).toEqual({cost_change:1200});
  expect(researchJsonMessage('results','33sfgsf')).toContain('valid JSON');
  expect(()=>parseResearchJson('input_versions','[1,2]')).toThrow('JSON object');
  expect(parseResearchJson('results','')).toBeNull();
 });
 it('shows explicit warnings before destructive changes',()=>{
  expect(confirmFileTrash('demand.csv')).toContain('can be restored');
  expect(confirmRecordRemoval('task','Draft',2)).toContain('2 child task(s)');
 });
});
