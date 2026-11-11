import {describe,it,expect} from 'vitest';
import {canReadWorkspace,canWriteWorkspace,canPublish,canManageViewers,canBackupWorkspace} from './access';
describe('role-specific UI controls; RLS is authoritative',()=>{
 it('owner retains full functionality',()=>expect([canReadWorkspace('owner'),canWriteWorkspace('owner'),canPublish('owner'),canManageViewers('owner'),canBackupWorkspace('owner')]).toEqual([true,true,true,true,true]));
 it('editor remains writer without ownership privileges',()=>expect([canReadWorkspace('editor'),canWriteWorkspace('editor'),canPublish('editor'),canManageViewers('editor'),canBackupWorkspace('editor')]).toEqual([true,true,false,false,false]));
 it('viewer is read-only and cannot restore backups',()=>expect([canReadWorkspace('viewer'),canWriteWorkspace('viewer'),canPublish('viewer'),canManageViewers('viewer'),canBackupWorkspace('viewer')]).toEqual([true,false,false,false,false]));
 it('anonymous and nonmembers never get private access',()=>{for(const role of ['','none','admin','guest','Viewer'])expect([canReadWorkspace(role),canWriteWorkspace(role),canPublish(role),canManageViewers(role),canBackupWorkspace(role)]).toEqual([false,false,false,false,false]);});
});
