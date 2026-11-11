-- Additive migration: invited read-only viewers, approved public summaries.
-- Stage in pull request; DO NOT apply to production without approval.
-- No existing membership, file record, or private object is deleted or overwritten.
begin;
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
 check(role in ('owner','editor','viewer'));

-- Owner-directory helper in a non-API schema prevents recursive RLS evaluation.
create schema if not exists app_private;
revoke all on schema app_private from public,anon;
grant usage on schema app_private to authenticated;
create or replace function app_private.current_user_is_owner()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members m
  where m.user_id=(select auth.uid()) and m.role='owner');
$$;
revoke all on function app_private.current_user_is_owner() from public,anon;
grant execute on function app_private.current_user_is_owner() to authenticated;

create or replace function public.can_view()
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.workspace_members m
  where m.user_id=(select auth.uid()) and m.role in ('owner','editor','viewer'));
$$;
revoke all on function public.can_view() from public,anon;
grant execute on function public.can_view() to authenticated;

-- The own_membership SELECT policy remains; these add owner directory and
-- viewer-only membership management. No role update grant is provided.
create policy workspace_members_owner_list on public.workspace_members
 for select to authenticated using ((select app_private.current_user_is_owner()));
create policy workspace_members_owner_add_viewer on public.workspace_members
 for insert to authenticated
 with check(role='viewer' and user_id<>(select auth.uid()) and (select app_private.current_user_is_owner()));
create policy workspace_members_owner_revoke_viewer on public.workspace_members
 for delete to authenticated
 using(role='viewer' and (select app_private.current_user_is_owner()));
grant select,insert,delete on public.workspace_members to authenticated;
revoke update on public.workspace_members from authenticated;

-- Change SELECT only. INSERT/UPDATE/DELETE policies retain can_edit(),
-- which never includes viewer. Existing model-run immutability is unchanged.
do $$
declare tab text;
begin
 foreach tab in array array['inputs','scenarios','model_runs','sensitivities',
   'tasks','folders','files','file_links']
 loop
  execute format('alter policy %I on public.%I using ((select public.can_view()))',
   tab||'_read',tab);
 end loop;
end $$;
alter policy gep_versions_read on public.file_versions
 using ((select public.can_view()));
alter policy gep_files_read on storage.objects
 using(bucket_id='research-files' and (select public.can_view()));

-- Anonymous access remains limited to published_entries. No automatic publication.
commit;
