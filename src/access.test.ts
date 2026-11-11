import {describe,it,expect} from 'vitest';
import {canReadWorkspace,canWriteWorkspace,canPublish,canManageViewers,canBackupWorkspace} from './access';
describe('public read-only research; owner is the only writer (RLS is authoritative)',()=>{
  it('allows anyone to read the research',()=>{
    for(const role of ['owner','viewer','editor','','uninvited']){
      expect(canReadWorkspace(role)).toBe(true);
    }
  });
  it('gives only Owner permission to edit, publish, and restore',()=>{
    expect([canWriteWorkspace('owner'),canPublish('owner'),canBackupWorkspace('owner')]).toEqual([true,true,true]);
    for(const role of ['','viewer','editor','uninvited']){
      expect([canWriteWorkspace(role),canPublish(role),canBackupWorkspace(role)]).toEqual([false,false,false]);
    }
  });
  it('does not require individual viewer administration',()=>{
    expect(canManageViewers('owner')).toBe(false);
    expect(canManageViewers('viewer')).toBe(false);
  });
});
