-- Security hardening: anonymous visitors must not have table privileges for
-- private research tables, in addition to existing row-level security policies.
revoke all privileges on table
  public.workspace_members,
  public.inputs,
  public.scenarios,
  public.model_runs,
  public.sensitivities,
  public.tasks,
  public.folders,
  public.files,
  public.file_links
from anon;

revoke insert, update, delete, truncate, references, trigger
on public.published_entries from anon;
grant select on public.published_entries to anon;
