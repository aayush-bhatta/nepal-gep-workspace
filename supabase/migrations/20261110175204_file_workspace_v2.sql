-- Nepal GEP file workspace v2: additive upgrade. No existing records/objects deleted.
-- Apply ONCE in the existing project, after reviewing current schema.
alter table public.files
  add column if not exists mime_type text,
  add column if not exists sha256 text,
  add column if not exists source_url text,
  add column if not exists document_title text,
  add column if not exists authors text,
  add column if not exists publication_year integer,
  add column if not exists source_reference text,
  add column if not exists source_access_date date,
  add column if not exists external_url text,
  add column if not exists research_role text not null default 'Other',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists current_version integer not null default 1;

alter table public.files add constraint gep_current_version_positive check (current_version > 0);
alter table public.files add constraint gep_role_choice check (research_role in ('Input','Paper / source','Methodology / code','Result','Report','Other'));
alter table public.files add constraint gep_file_digest_shape check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$');

create table if not exists public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  storage_path text not null unique,
  original_name text not null,
  byte_size bigint not null check (byte_size >= 0),
  mime_type text,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  notes text,
  created_at timestamptz not null default now(),
  unique (file_id, version_number)
);

create index if not exists gep_file_versions_parent_idx on public.file_versions(file_id, version_number desc);
alter table public.file_versions enable row level security;
revoke all on table public.file_versions from anon, authenticated;
grant select, insert on public.file_versions to authenticated;
create policy gep_versions_read on public.file_versions for select to authenticated
  using ((select public.can_edit()));
create policy gep_versions_insert on public.file_versions for insert to authenticated
  with check ((select public.can_edit()));

-- Backfill history for existing objects without changing their object key or bytes.
insert into public.file_versions (file_id, version_number, storage_path, original_name, byte_size, mime_type, sha256, created_at)
select id, 1, storage_path, original_name, byte_size, mime_type, sha256, created_at from public.files
on conflict (file_id, version_number) do nothing;

create function public.gep_capture_first_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.current_version = 1 then
    insert into public.file_versions (file_id, version_number, storage_path, original_name, byte_size, mime_type, sha256, created_at)
    values (new.id, 1, new.storage_path, new.original_name, new.byte_size, new.mime_type, new.sha256, new.created_at)
    on conflict (file_id, version_number) do nothing;
  end if;
  return new;
end;
$$;
create trigger gep_file_initial_version after insert on public.files
for each row execute function public.gep_capture_first_version();

-- Both the version row and current pointer change in the same DB transaction.
-- New storage object is uploaded first under a distinct key; existing object is untouched.
create function public.gep_register_file_version(
  p_file_id uuid, p_storage_path text, p_original_name text,
  p_byte_size bigint, p_mime_type text, p_sha256 text, p_notes text default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare v_file public.files%rowtype; v_next integer;
begin
  if not public.can_edit() then raise exception 'Not authorized'; end if;
  if p_byte_size < 0 or p_byte_size > 20971520 then raise exception 'File exceeds storage limit'; end if;
  if p_storage_path !~ '^objects/[0-9a-f-]{36}$' then raise exception 'Invalid object key'; end if;
  if p_original_name is null or btrim(p_original_name) = '' then raise exception 'Filename required'; end if;
  select * into v_file from public.files where id = p_file_id for update;
  if not found then raise exception 'File not found'; end if;
  v_next := (select coalesce(max(version_number),0)+1 from public.file_versions where file_id=p_file_id);
  insert into public.file_versions(file_id, version_number, storage_path, original_name, byte_size, mime_type, sha256, notes)
  values(p_file_id,v_next,p_storage_path,p_original_name,p_byte_size,p_mime_type,p_sha256,p_notes);
  update public.files set current_version=v_next, storage_path=p_storage_path,
    original_name=p_original_name, byte_size=p_byte_size, mime_type=p_mime_type,
    sha256=p_sha256 where id=p_file_id;
  return v_next;
end;
$$;

-- Folder paths are virtual: only database values change, not Supabase Storage bytes.
create function public.gep_move_folder(p_old_path text, p_destination text, p_name text)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_new text;
begin
  if not public.can_edit() then raise exception 'Not authorized'; end if;
  if p_old_path is null or p_old_path='' then raise exception 'Cannot modify root'; end if;
  if p_name is null or btrim(p_name)='' or p_name in ('.','..') or (position('/' in p_name)>0 or position(chr(92) in p_name)>0) or position('..' in p_name)>0 then
    raise exception 'Invalid folder name';
  end if;
  if p_destination is null then p_destination:=''; end if;
  v_new := case when p_destination='' then btrim(p_name) else p_destination||'/'||btrim(p_name) end;
  if length(v_new)>400 then raise exception 'Folder path too long'; end if;
  if v_new=p_old_path then return v_new; end if;
  if p_destination=p_old_path or left(p_destination,length(p_old_path)+1)=p_old_path||'/' then
    raise exception 'Cannot move a folder inside itself';
  end if;
  perform pg_advisory_xact_lock(hashtext('nepal-gep-folder-paths'));
  if not exists(select 1 from public.folders where path=p_old_path) then raise exception 'Folder not found'; end if;
  if p_destination<>'' and not exists(select 1 from public.folders where path=p_destination) then
    raise exception 'Destination folder not found';
  end if;
  if exists (
    select 1 from public.folders src
    join public.folders dest on dest.path=v_new||substr(src.path,length(p_old_path)+1)
    where (src.path=p_old_path or left(src.path,length(p_old_path)+1)=p_old_path||'/')
      and not (dest.path=p_old_path or left(dest.path,length(p_old_path)+1)=p_old_path||'/')
  ) then raise exception 'Destination already contains a conflicting folder'; end if;
  update public.folders set path=v_new||substr(path,length(p_old_path)+1)
  where path=p_old_path or left(path,length(p_old_path)+1)=p_old_path||'/';
  update public.files set folder_path=v_new||substr(folder_path,length(p_old_path)+1)
  where folder_path=p_old_path or left(folder_path,length(p_old_path)+1)=p_old_path||'/';
  return v_new;
end;
$$;

create function public.gep_delete_empty_folder(p_path text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not public.can_edit() then raise exception 'Not authorized'; end if;
  if p_path is null or p_path='' then raise exception 'Cannot delete root'; end if;
  perform pg_advisory_xact_lock(hashtext('nepal-gep-folder-paths'));
  if exists(select 1 from public.folders where path<>p_path and left(path,length(p_path)+1)=p_path||'/')
    or exists(select 1 from public.files where folder_path=p_path or left(folder_path,length(p_path)+1)=p_path||'/')
  then raise exception 'Folder contains files or subfolders; move them first'; end if;
  delete from public.folders where path=p_path;
  return found;
end;
$$;

revoke all on function public.gep_register_file_version(uuid,text,text,bigint,text,text,text) from public,anon;
revoke all on function public.gep_move_folder(text,text,text) from public,anon;
revoke all on function public.gep_delete_empty_folder(text) from public,anon;
grant execute on function public.gep_register_file_version(uuid,text,text,bigint,text,text,text) to authenticated;
grant execute on function public.gep_move_folder(text,text,text) to authenticated;
grant execute on function public.gep_delete_empty_folder(text) to authenticated;

-- Never publish file history through an anon-facing view or grant.
