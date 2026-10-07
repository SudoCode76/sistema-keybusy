alter table public.subscription_access_details
  add column if not exists login_password_changed_at timestamptz;

alter table public.account_credentials
  add column if not exists platform_password_changed_at timestamptz;

create or replace function public.track_spotify_access_password_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  service_slug text;
begin
  select sv.slug into service_slug
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  join public.services sv on sv.id = p.service_id
  where s.id = new.subscription_id;

  if service_slug = 'spotify' then
    if tg_op = 'INSERT' then
      if nullif(new.login_password, '') is not null then
        new.login_password_changed_at := now();
      end if;
    elsif new.login_password is distinct from old.login_password then
      new.login_password_changed_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists track_spotify_access_password_change
  on public.subscription_access_details;

create trigger track_spotify_access_password_change
before insert or update of login_password on public.subscription_access_details
for each row execute function public.track_spotify_access_password_change();

create or replace function public.track_spotify_mother_password_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  service_slug text;
  old_platform_password text;
  old_legacy_password text;
  new_platform_password text;
  new_legacy_password text;
  old_password text;
  new_password text;
begin
  select sv.slug into service_slug
  from public.service_accounts sa
  join public.services sv on sv.id = sa.service_id
  where sa.id = new.service_account_id;

  if service_slug is distinct from 'spotify' then
    return new;
  end if;

  select
    max(nullif(regexp_replace(line, '^[^:]+:\s*', ''), '')) filter (
      where btrim(split_part(line, ':', 1)) = 'platform_password'
    ),
    max(nullif(regexp_replace(line, '^[^:]+:\s*', ''), '')) filter (
      where btrim(split_part(line, ':', 1)) = 'password'
    )
  into new_platform_password, new_legacy_password
  from regexp_split_to_table(new.secret_payload, E'\r?\n') as line
  where position(':' in line) > 0;

  new_password := coalesce(new_platform_password, new_legacy_password);

  if tg_op = 'INSERT' then
    if new_password is not null then
      new.platform_password_changed_at := now();
    end if;
    return new;
  end if;

  select
    max(nullif(regexp_replace(line, '^[^:]+:\s*', ''), '')) filter (
      where btrim(split_part(line, ':', 1)) = 'platform_password'
    ),
    max(nullif(regexp_replace(line, '^[^:]+:\s*', ''), '')) filter (
      where btrim(split_part(line, ':', 1)) = 'password'
    )
  into old_platform_password, old_legacy_password
  from regexp_split_to_table(old.secret_payload, E'\r?\n') as line
  where position(':' in line) > 0;

  old_password := coalesce(old_platform_password, old_legacy_password);
  if new_password is distinct from old_password then
    new.platform_password_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists track_spotify_mother_password_change
  on public.account_credentials;

create trigger track_spotify_mother_password_change
before insert or update of secret_payload on public.account_credentials
for each row execute function public.track_spotify_mother_password_change();
