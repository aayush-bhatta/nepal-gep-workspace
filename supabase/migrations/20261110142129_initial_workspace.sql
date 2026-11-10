-- Execute in a new Supabase project only. Owner assignment is an explicit admin SQL step.
create extension if not exists pgcrypto;
create table public.workspace_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','editor')),
 created_at timestamptz not null default now()
);
create or replace function public.can_edit() returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.workspace_members where user_id=(select auth.uid()) and role in ('owner','editor'))
$$;
create or replace function public.is_owner() returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.workspace_members where user_id=(select auth.uid()) and role='owner')
$$;
create table public.inputs (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0),
 category text not null check(category in ('Hourly demand','ROR hydrology','PROR hydrology','Storage hydro','Solar PV profiles','BESS assumptions','Technology costs','Reliability constraints','Reserve margin','Imports / exports','Policy constraints')),
 horizon text not null default 'shared' check(horizon in ('shared','2030','2040','2050')),
 value_text text, unit text, source_url text, document_title text, publication_year integer,
 source_reference text, source_access_date date, status text not null default 'Missing' check(status in ('Missing','Tentative','Under review','Verified')),
 checked_at date, validation_method text, validation_evidence text, assumptions text, missing_inputs text,
 model_version text, verified_results text, unresolved_issues text, next_action text,
 details jsonb not null default '{}'::jsonb, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint verified_input_evidence check(status <> 'Verified' or (nullif(trim(source_url),'') is not null and checked_at is not null and nullif(trim(validation_evidence),'') is not null))
);
create table public.scenarios (
 id uuid primary key default gen_random_uuid(), horizon integer unique not null check(horizon in (2030,2040,2050)),
 name text not null, description text, created_at timestamptz not null default now()
);
insert into public.scenarios(horizon,name) values (2030,'2030 planning horizon'),(2040,'2040 planning horizon'),(2050,'2050 planning horizon');
create table public.model_runs (
 id uuid primary key default gen_random_uuid(), horizon integer not null check(horizon in (2030,2040,2050)),
 scenario_name text not null, model_version text, git_commit text, input_versions jsonb not null default '{}'::jsonb,
 run_date timestamptz, solver text, solver_version text, termination_status text,
 objective_value numeric, cost_basis text, runtime_seconds numeric, optimality_gap numeric,
 capacity_mix jsonb, energy_mix jsonb, energy_accounting_basis text, reliability_results jsonb,
 imports_mwh numeric, exports_mwh numeric, curtailment_mwh numeric, unserved_energy_mwh numeric,
 status text not null default 'Not run' check(status in ('Not run','Running','Completed, unverified','Under review','Verified','Failed / infeasible')),
 evidence text, issues text, next_action text,
 created_at timestamptz not null default now(),
 constraint verified_run_evidence check(status<>'Verified' or (run_date is not null and termination_status is not null and nullif(trim(evidence),'') is not null and nullif(trim(energy_accounting_basis),'') is not null))
);
create table public.sensitivities (
 id uuid primary key default gen_random_uuid(), title text not null, horizon integer not null check(horizon in(2030,2040,2050)),
 baseline_run_id uuid references public.model_runs(id) on delete restrict, parameter text, baseline_value text,
 sensitivity_value text, unit text, justification text, model_version text,
 status text not null default 'Not run', results jsonb, absolute_change numeric, percentage_change numeric,
 evidence text, issues text, next_action text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), title text not null, parent_id uuid references public.tasks(id) on delete set null,
 status text not null default 'Not started' check(status in ('Not started','In progress','Blocked','Under review','Complete')),
 evidence text, next_action text, due_date date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint completed_task_evidence check(status <> 'Complete' or nullif(trim(evidence),'') is not null)
);
-- Initial workstreams are explicitly not started, with no invented evidence.
insert into public.tasks(title,status) values
 ('Data collection and validation','Not started'),
 ('Python PuLP formulation','Not started'),
 ('Hourly simulations','Not started'),
 ('Figures','Not started'),
 ('Tables','Not started'),
 ('Word report','Not started'),
 ('PDF report','Not started');
create table public.folders (
 id uuid primary key default gen_random_uuid(), path text not null unique check(path !~ '(^/|\.\.|//)'),
 created_at timestamptz not null default now()
);
insert into public.folders(path) values ('Data'),('Data/Demand'),('Data/Hydrology'),('Data/Solar'),('Data/Costs'),('Models'),('Models/Python scripts'),('Models/Model versions'),('Results'),('Results/2030'),('Results/2040'),('Results/2050'),('Reports'),('Reports/Word'),('Reports/PDF'),('Reports/Figures'),('Reports/Tables');
create table public.files (
 id uuid primary key default gen_random_uuid(), folder_path text not null default 'Data',
 original_name text not null, storage_path text not null unique, byte_size bigint not null check(byte_size>=0),
 notes text, version text, trashed_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.file_links (
 id uuid primary key default gen_random_uuid(), file_id uuid not null references public.files(id) on delete cascade,
 record_type text not null check(record_type in ('inputs','scenarios','model_runs','sensitivities','tasks')),
 record_id uuid not null, created_at timestamptz not null default now(),unique(file_id,record_type,record_id)
);
-- Public releases contain only deliberately selected, copied, safe-to-publish fields.
create table public.published_entries (
 id uuid primary key default gen_random_uuid(), title text not null, kind text not null check(kind in ('input','result','report')),
 summary text, public_payload jsonb not null default '{}'::jsonb,
 published_at timestamptz not null default now()
);
create or replace function public.bump_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now();return new;end $$;
create trigger inputs_modified before update on public.inputs for each row execute function public.bump_updated_at();
create trigger tasks_modified before update on public.tasks for each row execute function public.bump_updated_at();
create trigger sensitivities_modified before update on public.sensitivities for each row execute function public.bump_updated_at();
create trigger files_modified before update on public.files for each row execute function public.bump_updated_at();
-- Runs are immutable once inserted. Changes must be recorded as new runs.
create or replace function public.deny_run_mutations() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Model run records are immutable: create another run';end $$;
create trigger runs_immutable before update or delete on public.model_runs for each row execute function public.deny_run_mutations();
-- Role assignment is never possible from frontend credentials, even for the owner.
alter table public.workspace_members enable row level security;
create policy members_read_self on public.workspace_members for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.workspace_members from anon,authenticated;
grant select on public.workspace_members to authenticated;
-- Private tables, visible only to authorised members. No public read of private columns.
do $$ declare t text;begin
 foreach t in array array['inputs','scenarios','model_runs','sensitivities','tasks','folders','files','file_links'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy %I on public.%I for select to authenticated using ((select public.can_edit()))',t||'_read',t);
 execute format('create policy %I on public.%I for insert to authenticated with check ((select public.can_edit()))',t||'_add',t);
 execute format('create policy %I on public.%I for update to authenticated using ((select public.can_edit())) with check ((select public.can_edit()))',t||'_edit',t);
 execute format('create policy %I on public.%I for delete to authenticated using ((select public.can_edit()))',t||'_del',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.published_entries enable row level security;
create policy publications_read on public.published_entries for select to anon,authenticated using(true);
create policy publications_insert on public.published_entries for insert to authenticated with check ((select public.is_owner()));
create policy publications_update on public.published_entries for update to authenticated using((select public.is_owner())) with check((select public.is_owner()));
create policy publications_delete on public.published_entries for delete to authenticated using((select public.is_owner()));
grant select on public.published_entries to anon,authenticated;
grant insert,update,delete on public.published_entries to authenticated;
-- Private object bucket; actual file is stored using unique id key, never a public URL.
insert into storage.buckets(id,name,public,file_size_limit) values ('research-files','research-files',false,20971520)
on conflict (id) do update set public=false,file_size_limit=20971520;
create policy gep_files_read on storage.objects for select to authenticated using(bucket_id='research-files' and (select public.can_edit()));
create policy gep_files_write on storage.objects for insert to authenticated with check(bucket_id='research-files' and (select public.can_edit()));
create policy gep_files_update on storage.objects for update to authenticated using(bucket_id='research-files' and (select public.can_edit())) with check(bucket_id='research-files' and (select public.can_edit()));
create policy gep_files_delete on storage.objects for delete to authenticated using(bucket_id='research-files' and (select public.can_edit()));
create index inputs_horizon_status_idx on public.inputs(horizon,status);
create index runs_horizon_idx on public.model_runs(horizon,created_at desc);
create index files_folder_idx on public.files(folder_path,trashed_at);
create index tasks_parent_idx on public.tasks(parent_id);
-- Owner setup after creating a user through Supabase Auth (SQL Editor, admin only):
-- insert into public.workspace_members(user_id,role) select id,'owner' from auth.users where email='YOUR_EMAIL' on conflict(user_id) do update set role='owner';
