-- Add-only research activity history and reversible model-run archiving.
-- Stage this migration. Apply once after PR review, before deploying the dependent UI.
-- Existing records, owner permissions, and Storage objects are not modified.
begin;

create table public.model_run_visibility (
  run_id uuid primary key references public.model_runs(id) on delete restrict,
  archived_at timestamptz,
  archive_reason text,
  updated_at timestamptz not null default now()
);
alter table public.model_run_visibility enable row level security;
revoke all on public.model_run_visibility from anon, authenticated;
grant select on public.model_run_visibility to anon,authenticated;
grant insert,update on public.model_run_visibility to authenticated;
create policy gep_run_visibility_read on public.model_run_visibility
  for select to anon,authenticated using(true);
create policy gep_run_visibility_insert on public.model_run_visibility
  for insert to authenticated with check((select public.can_edit()));
create policy gep_run_visibility_update on public.model_run_visibility
  for update to authenticated using((select public.can_edit()))
  with check((select public.can_edit()));
create trigger gep_visibility_updated before update on public.model_run_visibility
  for each row execute function public.bump_updated_at();

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  entity_type text not null,
  record_id uuid,
  action text not null,
  label text not null,
  changed_fields text[] not null default '{}'::text[],
  actor_label text not null default 'Owner'
);
create index gep_activity_recent_idx on public.activity_events(occurred_at desc);
alter table public.activity_events enable row level security;
revoke all on public.activity_events from anon,authenticated;
grant select on public.activity_events to anon,authenticated;
create policy gep_activity_public_read on public.activity_events
  for select to anon,authenticated using(true);

-- This function records safe metadata only: not old/new values, CSV contents,
-- secrets, source text, email, user UUID or Storage file bytes.
-- Keep it in the NON-exposed app_private schema, never the public Data API schema.
create or replace function app_private.gep_audit_changes()
returns trigger language plpgsql security definer set search_path='' as $audit$
declare old_data jsonb := '{}'::jsonb;
        new_data jsonb := '{}'::jsonb;
        data_ jsonb := '{}'::jsonb;
        label_ text;
        action_ text;
        changed_ text[] := '{}'::text[];
        record_id_ uuid;
begin
  if tg_op <> 'INSERT' then old_data := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_data := to_jsonb(new); end if;
  if tg_op='UPDATE' and old_data=new_data then return new; end if;
  data_ := case when tg_op='DELETE' then old_data else new_data end;
  record_id_ := case when tg_table_name='model_run_visibility'
    then (data_->>'run_id')::uuid else (data_->>'id')::uuid end;
  label_ := coalesce(nullif(data_->>'original_name',''),nullif(data_->>'title',''),
    nullif(data_->>'scenario_name',''),nullif(data_->>'path',''),
    nullif(data_->>'name',''));
  if tg_table_name='model_run_visibility' then
    select coalesce(r.scenario_name,'Untitled model run') || ' (' || r.horizon::text || ')'
      into label_ from public.model_runs r where r.id=record_id_;
  end if;
  label_ := coalesce(label_,'Unnamed research record');
  if tg_op='UPDATE' then
    select coalesce(array_agg(k order by k),'{}'::text[]) into changed_
      from jsonb_object_keys(new_data) as k
      where old_data->k is distinct from new_data->k
        and k not in ('updated_at','version');
  end if;
  action_ := case tg_op when 'INSERT' then 'added' when 'DELETE' then 'deleted'
    else 'updated' end;
  if tg_table_name='files' and tg_op='UPDATE' then
    if old_data->>'trashed_at' is null and new_data->>'trashed_at' is not null then
      action_:='trashed';
    elsif old_data->>'trashed_at' is not null and new_data->>'trashed_at' is null then
      action_:='restored';
    end if;
  end if;
  if tg_table_name='model_run_visibility' then
    if new_data->>'archived_at' is not null then action_:='archived';
    else action_:='unarchived'; end if;
  end if;
  insert into public.activity_events(entity_type,record_id,action,label,changed_fields,actor_label)
    values(tg_table_name,record_id,action_,left(label_,250),changed_,
      case when (select auth.uid()) is null then 'System' else 'Owner' end);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$audit$;
revoke all on function app_private.gep_audit_changes() from public,anon,authenticated;

do $create_triggers$
declare t text;
begin
  foreach t in array array['inputs','scenarios','model_runs','sensitivities',
      'tasks','folders','files','file_versions','file_links','published_entries',
      'model_run_visibility']
  loop
    execute format(
      'create trigger gep_activity_capture after insert or update or delete on public.%I for each row execute function app_private.gep_audit_changes()',t);
  end loop;
end $create_triggers$;
commit;
