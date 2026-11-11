/** UI checks only: Supabase RLS and Storage policies are authoritative. */
export type WorkspaceRole = 'owner' | 'editor' | 'viewer' | '';
export function canReadWorkspace(role:string):boolean { return role==='owner'||role==='editor'||role==='viewer'; }
export function canWriteWorkspace(role:string):boolean { return role==='owner'||role==='editor'; }
export function canPublish(role:string):boolean { return role==='owner'; }
export function canManageViewers(role:string):boolean { return role==='owner'; }
export function canBackupWorkspace(role:string):boolean { return role==='owner'; }
