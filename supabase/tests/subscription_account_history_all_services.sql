-- Run with psql in a disposable database: psql -v ON_ERROR_STOP=1 -f supabase/tests/subscription_account_history_all_services.sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end;
$$;
create schema private;

create table public.service_accounts (id uuid primary key);
create table public.subscriptions (
  id uuid primary key,
  service_account_id uuid references public.service_accounts(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.spotify_member_accounts (
  source_subscription_id uuid references public.subscriptions(id),
  service_account_id uuid not null references public.service_accounts(id),
  removed_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.subscription_account_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id),
  service_account_id uuid not null references public.service_accounts(id),
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  blocked_at timestamptz,
  block_reason text,
  purchase_cost_bob numeric(12, 2) not null default 0,
  purchase_cost_usdt numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint history_dates_check check (ended_at is null or ended_at >= assigned_at)
);

insert into public.service_accounts (id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');

insert into public.subscriptions (id, service_account_id, created_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() - interval '10 days'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', now() - interval '20 days'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', now() - interval '5 days');
update public.subscriptions set status = 'canceled'
where id = '10000000-0000-0000-0000-000000000003';

-- Existing private history must remain a single assignment.
insert into public.subscription_account_history (subscription_id, service_account_id, assigned_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() - interval '10 days');

-- A removed Spotify member ties the second sale to a previous plan.
insert into public.spotify_member_accounts (source_subscription_id, service_account_id, removed_at)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', now() - interval '2 days');

\ir ../migrations/202610210001_subscription_account_history_all_services.sql

do $$
begin
  if (select count(*) from public.subscription_account_history where subscription_id = '10000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'Existing private history was duplicated';
  end if;
  if (select count(*) from public.subscription_account_history where subscription_id = '10000000-0000-0000-0000-000000000002') <> 2 then
    raise exception 'Spotify old plan and current plan were not reconstructed';
  end if;
  if (select count(*) from public.subscription_account_history h join public.subscriptions s on s.id = h.subscription_id where h.subscription_id = '10000000-0000-0000-0000-000000000003' and h.is_estimated and s.status = 'canceled') <> 1 then
    raise exception 'Canceled sale did not keep its estimated baseline';
  end if;
end;
$$;

update public.subscriptions
set service_account_id = '00000000-0000-0000-0000-000000000002'
where id = '10000000-0000-0000-0000-000000000001';

-- Editing unrelated fields or assigning the same account must not add rows.
update public.subscriptions
set service_account_id = '00000000-0000-0000-0000-000000000002', updated_at = now()
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.subscription_account_history where subscription_id = '10000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'Account change did not create exactly one row';
  end if;
  if (select count(*) from public.subscription_account_history where subscription_id = '10000000-0000-0000-0000-000000000001' and ended_at is null and not is_estimated) <> 1 then
    raise exception 'New assignment was not recorded precisely';
  end if;
end;
$$;

update public.subscriptions set service_account_id = null
where id = '10000000-0000-0000-0000-000000000001';
update public.subscriptions set service_account_id = '00000000-0000-0000-0000-000000000001'
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if (select count(*) from public.subscription_account_history where subscription_id = '10000000-0000-0000-0000-000000000001') <> 3 then
    raise exception 'Reassignment to a previously used account was lost';
  end if;
  if (select count(*) from public.subscription_account_history where subscription_id = '10000000-0000-0000-0000-000000000001' and ended_at is null) <> 1 then
    raise exception 'More than one open assignment remains';
  end if;
end;
$$;
