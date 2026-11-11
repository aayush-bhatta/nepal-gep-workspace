-- Public research read-only access, Owner-only writes.
-- For approval after PR review: NOTHING in this file executes just by merging code.
-- All project records and storage object bytes remain untouched.
begin;
-- Keep the existing Owner and all memberships. Editing requires an Owner.
create or replace function public.can_edit()
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.workspace_members m
    where m.user_id=(select auth.uid()) and m.role='owner')
$$;
-- Existing authenticated policies now permit public READ through parallel policies.
-- Do not expose auth.users, workspace_members, credentials or account information.
do $public_read$
declare t text;
begin
 foreach t in array array['inputs','scenarios','model_runs','sensitivities','tasks',
 'folders','files','file_links','file_versions']
 loop
  execute format('grant select on table public.%I to anon,authenticated',t);
  execute format('create policy %I on public.%I for select to anon,authenticated using (true)',
    'gep_public_read_'||t,t);
 end loop;
end $public_read$;
-- The Storage bucket remains PRIVATE. Give anonymous/browser-key SELECT only
-- for objects recorded as versions of active GEP research documents.
-- The read policy is intentionally for "anon, authenticated"; signed-in users
-- who are not owners should also be able to browse public research.
create policy gep_public_registered_file_read
 on storage.objects for select to anon,authenticated using (
 bucket_id='research-files'
 and exists(select 1 from public.file_versions v
   join public.files f on f.id=v.file_id
   where v.storage_path=name and f.trashed_at is null)
);
-- File writes stay protected by Owner-only can_edit() in existing policies.
-- Auth membership/user tables are never readable by anon.
commit;
