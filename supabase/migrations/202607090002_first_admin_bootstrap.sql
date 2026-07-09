create or replace function public.claim_first_admin()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'An admin already exists';
  end if;

  update public.profiles
  set role = 'admin', status = 'active', updated_at = now()
  where id = auth.uid()
  returning * into profile_row;

  if profile_row.id is null then
    raise exception 'Profile not found';
  end if;

  return profile_row;
end;
$$;
