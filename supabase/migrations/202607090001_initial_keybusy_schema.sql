create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'customer');
create type public.record_status as enum ('active', 'inactive');
create type public.account_status as enum ('active', 'inactive', 'dead', 'replaced');
create type public.subscription_status as enum ('active', 'pending_renewal', 'expired', 'canceled', 'inactive');
create type public.billing_status as enum ('pending', 'paid', 'canceled', 'waived');
create type public.currency_code as enum ('BOB', 'USDT');
create type public.payment_type as enum ('new', 'renewal', 'adjustment');
create type public.cost_type as enum ('purchase', 'renewal', 'adjustment');
create type public.email_status as enum ('active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  full_name text not null default '',
  phone text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null,
  email text,
  phone text,
  notes text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact text,
  notes text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  slug text not null unique,
  name text not null,
  product_type text not null,
  default_duration_months integer not null default 1 check (default_duration_months > 0),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.email_addresses (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status public.email_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exchange_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'binance_p2p',
  asset text not null default 'USDT',
  fiat text not null default 'BOB',
  trade_type text not null default 'BUY',
  rows_requested integer not null default 20,
  average_price numeric(12, 6) not null check (average_price > 0),
  raw_ads jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now()
);

create table public.service_accounts (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id),
  provider_id uuid references public.providers(id) on delete set null,
  email_address_id uuid references public.email_addresses(id) on delete set null,
  replacement_account_id uuid references public.service_accounts(id) on delete set null,
  label text not null,
  login_email text,
  username text,
  base_cost_amount numeric(12, 2) not null default 0 check (base_cost_amount >= 0),
  base_cost_currency public.currency_code not null default 'USDT',
  base_cost_exchange_rate numeric(12, 6) check (base_cost_exchange_rate is null or base_cost_exchange_rate > 0),
  base_cost_bob numeric(12, 2) not null default 0,
  base_cost_usdt numeric(12, 2) not null default 0,
  status public.account_status not null default 'active',
  started_at timestamptz not null default now(),
  dead_at timestamptz,
  two_factor_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_accounts_dead_status_check check (
    (dead_at is null and status in ('active', 'inactive', 'replaced'))
    or (dead_at is not null and status in ('dead', 'replaced'))
  )
);

create table public.account_credentials (
  id uuid primary key default gen_random_uuid(),
  service_account_id uuid not null unique references public.service_accounts(id) on delete cascade,
  secret_payload text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spotify_family_plans (
  id uuid primary key default gen_random_uuid(),
  service_account_id uuid not null unique references public.service_accounts(id) on delete cascade,
  invite_url text,
  address text,
  seats_total integer not null default 6 check (seats_total > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id),
  service_account_id uuid references public.service_accounts(id) on delete set null,
  slot_label text,
  status public.subscription_status not null default 'active',
  starts_on date not null default current_date,
  ends_on date not null,
  duration_months integer not null default 1 check (duration_months > 0),
  current_price_amount numeric(12, 2) not null default 0 check (current_price_amount >= 0),
  current_price_currency public.currency_code not null default 'BOB',
  current_exchange_rate numeric(12, 6) check (current_exchange_rate is null or current_exchange_rate > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_date_check check (ends_on >= starts_on)
);

create table public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_on date not null,
  status public.billing_status not null default 'pending',
  expected_amount numeric(12, 2) not null default 0 check (expected_amount >= 0),
  expected_currency public.currency_code not null default 'BOB',
  exchange_rate numeric(12, 6) check (exchange_rate is null or exchange_rate > 0),
  expected_bob numeric(12, 2) not null default 0,
  expected_usdt numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_cycles_date_check check (period_end >= period_start)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  billing_cycle_id uuid references public.billing_cycles(id) on delete set null,
  payment_type public.payment_type not null default 'renewal',
  paid_at timestamptz not null default now(),
  amount numeric(12, 2) not null check (amount >= 0),
  currency public.currency_code not null default 'BOB',
  exchange_rate numeric(12, 6) check (exchange_rate is null or exchange_rate > 0),
  amount_bob numeric(12, 2) not null default 0,
  amount_usdt numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  service_account_id uuid references public.service_accounts(id) on delete set null,
  provider_id uuid references public.providers(id) on delete set null,
  cost_type public.cost_type not null default 'renewal',
  paid_at timestamptz not null default now(),
  amount numeric(12, 2) not null check (amount >= 0),
  currency public.currency_code not null default 'USDT',
  exchange_rate numeric(12, 6) check (exchange_rate is null or exchange_rate > 0),
  amount_bob numeric(12, 2) not null default 0,
  amount_usdt numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table public.email_usages (
  id uuid primary key default gen_random_uuid(),
  email_address_id uuid not null references public.email_addresses(id) on delete cascade,
  service_account_id uuid references public.service_accounts(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  purpose text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index customers_profile_id_idx on public.customers(profile_id);
create index service_accounts_service_id_idx on public.service_accounts(service_id);
create index service_accounts_provider_id_idx on public.service_accounts(provider_id);
create index subscriptions_customer_id_idx on public.subscriptions(customer_id);
create index subscriptions_account_id_idx on public.subscriptions(service_account_id);
create index billing_cycles_subscription_id_idx on public.billing_cycles(subscription_id);
create index payments_paid_at_idx on public.payments(paid_at);
create index costs_paid_at_idx on public.costs(paid_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger set_providers_updated_at before update on public.providers for each row execute function public.set_updated_at();
create trigger set_email_addresses_updated_at before update on public.email_addresses for each row execute function public.set_updated_at();
create trigger set_service_accounts_updated_at before update on public.service_accounts for each row execute function public.set_updated_at();
create trigger set_account_credentials_updated_at before update on public.account_credentials for each row execute function public.set_updated_at();
create trigger set_spotify_family_plans_updated_at before update on public.spotify_family_plans for each row execute function public.set_updated_at();
create trigger set_subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger set_billing_cycles_updated_at before update on public.billing_cycles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.is_customer_owner(customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where id = customer_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace view public.monthly_revenue_summary as
with paid as (
  select
    date_trunc('month', paid_at)::date as month,
    sum(amount_bob) as collected_bob,
    sum(amount_usdt) as collected_usdt
  from public.payments
  group by 1
),
pending as (
  select
    date_trunc('month', due_on)::date as month,
    sum(expected_bob) as pending_bob,
    sum(expected_usdt) as pending_usdt
  from public.billing_cycles
  where status = 'pending'
  group by 1
),
costs_by_month as (
  select
    date_trunc('month', paid_at)::date as month,
    sum(amount_bob) as cost_bob,
    sum(amount_usdt) as cost_usdt
  from public.costs
  group by 1
)
select
  coalesce(paid.month, pending.month, costs_by_month.month) as month,
  coalesce(paid.collected_bob, 0)::numeric(12, 2) as collected_bob,
  coalesce(paid.collected_usdt, 0)::numeric(12, 2) as collected_usdt,
  coalesce(pending.pending_bob, 0)::numeric(12, 2) as pending_bob,
  coalesce(pending.pending_usdt, 0)::numeric(12, 2) as pending_usdt,
  (coalesce(paid.collected_bob, 0) + coalesce(pending.pending_bob, 0))::numeric(12, 2) as projected_bob,
  (coalesce(paid.collected_usdt, 0) + coalesce(pending.pending_usdt, 0))::numeric(12, 2) as projected_usdt,
  coalesce(costs_by_month.cost_bob, 0)::numeric(12, 2) as cost_bob,
  coalesce(costs_by_month.cost_usdt, 0)::numeric(12, 2) as cost_usdt,
  (coalesce(paid.collected_bob, 0) - coalesce(costs_by_month.cost_bob, 0))::numeric(12, 2) as profit_bob,
  (coalesce(paid.collected_usdt, 0) - coalesce(costs_by_month.cost_usdt, 0))::numeric(12, 2) as profit_usdt
from paid
full join pending using (month)
full join costs_by_month on costs_by_month.month = coalesce(paid.month, pending.month);

create or replace view public.subscription_status_view as
select
  s.id,
  c.display_name as customer_name,
  p.name as product_name,
  sv.name as service_name,
  sa.label as account_label,
  s.slot_label,
  s.status,
  s.starts_on,
  s.ends_on,
  case
    when s.status in ('canceled', 'inactive') then s.status::text
    when s.ends_on < current_date then 'expired'
    when s.ends_on <= current_date + interval '7 days' then 'pending_renewal'
    else 'active'
  end as computed_status,
  s.current_price_amount,
  s.current_price_currency
from public.subscriptions s
join public.customers c on c.id = s.customer_id
join public.products p on p.id = s.product_id
join public.services sv on sv.id = p.service_id
left join public.service_accounts sa on sa.id = s.service_account_id;

create or replace view public.account_profit_view as
select
  sa.id as service_account_id,
  sa.label,
  sv.name as service_name,
  coalesce((select sum(pay.amount_bob) from public.subscriptions sub join public.payments pay on pay.subscription_id = sub.id where sub.service_account_id = sa.id), 0)::numeric(12, 2) as income_bob,
  coalesce((select sum(pay.amount_usdt) from public.subscriptions sub join public.payments pay on pay.subscription_id = sub.id where sub.service_account_id = sa.id), 0)::numeric(12, 2) as income_usdt,
  coalesce((select sum(co.amount_bob) from public.costs co where co.service_account_id = sa.id), 0)::numeric(12, 2) as cost_bob,
  coalesce((select sum(co.amount_usdt) from public.costs co where co.service_account_id = sa.id), 0)::numeric(12, 2) as cost_usdt,
  (coalesce((select sum(pay.amount_bob) from public.subscriptions sub join public.payments pay on pay.subscription_id = sub.id where sub.service_account_id = sa.id), 0) - coalesce((select sum(co.amount_bob) from public.costs co where co.service_account_id = sa.id), 0))::numeric(12, 2) as profit_bob,
  (coalesce((select sum(pay.amount_usdt) from public.subscriptions sub join public.payments pay on pay.subscription_id = sub.id where sub.service_account_id = sa.id), 0) - coalesce((select sum(co.amount_usdt) from public.costs co where co.service_account_id = sa.id), 0))::numeric(12, 2) as profit_usdt
from public.service_accounts sa
join public.services sv on sv.id = sa.service_id
;

create or replace view public.customer_portal_orders_view as
select
  s.id as subscription_id,
  c.profile_id,
  c.display_name as customer_name,
  sv.name as service_name,
  p.name as product_name,
  s.slot_label,
  s.status,
  s.starts_on,
  s.ends_on,
  s.current_price_amount,
  s.current_price_currency,
  max(pay.paid_at) as last_paid_at
from public.subscriptions s
join public.customers c on c.id = s.customer_id
join public.products p on p.id = s.product_id
join public.services sv on sv.id = p.service_id
left join public.payments pay on pay.subscription_id = s.id
group by s.id, c.profile_id, c.display_name, sv.name, p.name;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.email_addresses enable row level security;
alter table public.exchange_rate_snapshots enable row level security;
alter table public.service_accounts enable row level security;
alter table public.account_credentials enable row level security;
alter table public.spotify_family_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_cycles enable row level security;
alter table public.payments enable row level security;
alter table public.costs enable row level security;
alter table public.email_usages enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_all" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "customers_admin_all" on public.customers for all using (public.is_admin()) with check (public.is_admin());
create policy "customers_select_own" on public.customers for select using (profile_id = auth.uid());

create policy "providers_admin_all" on public.providers for all using (public.is_admin()) with check (public.is_admin());
create policy "services_admin_all" on public.services for all using (public.is_admin()) with check (public.is_admin());
create policy "services_customer_read" on public.services for select using (auth.uid() is not null);
create policy "products_admin_all" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "products_customer_read" on public.products for select using (auth.uid() is not null);

create policy "email_addresses_admin_all" on public.email_addresses for all using (public.is_admin()) with check (public.is_admin());
create policy "exchange_rate_snapshots_admin_all" on public.exchange_rate_snapshots for all using (public.is_admin()) with check (public.is_admin());
create policy "service_accounts_admin_all" on public.service_accounts for all using (public.is_admin()) with check (public.is_admin());
create policy "account_credentials_admin_all" on public.account_credentials for all using (public.is_admin()) with check (public.is_admin());
create policy "spotify_family_plans_admin_all" on public.spotify_family_plans for all using (public.is_admin()) with check (public.is_admin());

create policy "subscriptions_admin_all" on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());
create policy "subscriptions_customer_read" on public.subscriptions for select using (public.is_customer_owner(customer_id));

create policy "billing_cycles_admin_all" on public.billing_cycles for all using (public.is_admin()) with check (public.is_admin());
create policy "billing_cycles_customer_read" on public.billing_cycles for select using (
  exists (
    select 1 from public.subscriptions s
    where s.id = subscription_id
      and public.is_customer_owner(s.customer_id)
  )
);

create policy "payments_admin_all" on public.payments for all using (public.is_admin()) with check (public.is_admin());
create policy "payments_customer_read" on public.payments for select using (public.is_customer_owner(customer_id));

create policy "costs_admin_all" on public.costs for all using (public.is_admin()) with check (public.is_admin());
create policy "email_usages_admin_all" on public.email_usages for all using (public.is_admin()) with check (public.is_admin());

insert into public.services (slug, name, description) values
  ('netflix', 'Netflix', 'Cuentas y perfiles Netflix'),
  ('spotify', 'Spotify', 'Planes familiares Spotify'),
  ('chatgpt-private', 'ChatGPT Plus privado', 'Cuentas privadas con posible asiento Codex'),
  ('chatgpt-shared', 'ChatGPT Plus compartido', 'Accesos compartidos ChatGPT Plus'),
  ('disney', 'Disney+', 'Perfiles Disney+'),
  ('canva', 'Canva', 'Perfiles Canva'),
  ('other', 'Otros', 'Otros servicios digitales')
on conflict (slug) do nothing;

insert into public.products (service_id, slug, name, product_type)
select id, 'netflix-profile', 'Perfil Netflix', 'profile' from public.services where slug = 'netflix'
on conflict (slug) do nothing;
insert into public.products (service_id, slug, name, product_type)
select id, 'spotify-family-member', 'Miembro Spotify familiar', 'seat' from public.services where slug = 'spotify'
on conflict (slug) do nothing;
insert into public.products (service_id, slug, name, product_type)
select id, 'chatgpt-private-main', 'ChatGPT privado principal', 'seat' from public.services where slug = 'chatgpt-private'
on conflict (slug) do nothing;
insert into public.products (service_id, slug, name, product_type)
select id, 'chatgpt-private-codex', 'ChatGPT privado Codex', 'seat' from public.services where slug = 'chatgpt-private'
on conflict (slug) do nothing;
insert into public.products (service_id, slug, name, product_type)
select id, 'chatgpt-shared-seat', 'ChatGPT compartido', 'seat' from public.services where slug = 'chatgpt-shared'
on conflict (slug) do nothing;
insert into public.products (service_id, slug, name, product_type)
select id, 'disney-profile', 'Perfil Disney+', 'profile' from public.services where slug = 'disney'
on conflict (slug) do nothing;
insert into public.products (service_id, slug, name, product_type)
select id, 'canva-profile', 'Perfil Canva', 'profile' from public.services where slug = 'canva'
on conflict (slug) do nothing;
