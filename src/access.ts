/** Frontend display helpers only. Supabase RLS is the authoritative security boundary. */
export type WorkspaceRole = 'owner' | 'editor' | 'viewer' | '';
export function canReadWorkspace(_role:string):boolean { return true; }
export function canWriteWorkspace(role:string):boolean { return role==='owner'; }
export function canPublish(role:string):boolean { return role==='owner'; }
export function canManageViewers(_role:string):boolean { return false; }
export function canBackupWorkspace(role:string):boolean { return role==='owner'; }
