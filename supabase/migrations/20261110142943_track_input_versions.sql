-- Applied to the live Nepal GEP project as migration track_input_versions.
-- Automatically increment input dataset versions on updates; every saved edit is a new version.
create function public.bump_input_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

create trigger input_increment_version
before update on public.inputs
for each row execute function public.bump_input_version();
