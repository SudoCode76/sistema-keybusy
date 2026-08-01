create table if not exists public.subscription_account_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  service_account_id uuid not null references public.service_accounts(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  blocked_at timestamptz,
  block_reason text,
  purchase_cost_bob numeric(12, 2) not null default 0,
  purchase_cost_usdt numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint subscription_account_history_dates_check check (ended_at is null or ended_at >= assigned_at),
  constraint subscription_account_history_block_check check (blocked_at is null or blocked_at >= assigned_at)
);

create index if not exists subscription_account_history_subscription_idx on public.subscription_account_history(subscription_id);
create index if not exists subscription_account_history_account_idx on public.subscription_account_history(service_account_id);

alter table public.subscription_account_history enable row level security;
create policy "subscription_account_history_admin_all" on public.subscription_account_history
  for all using (private.is_admin()) with check (private.is_admin());

insert into public.subscription_account_history (subscription_id, service_account_id, assigned_at)
select s.id, s.service_account_id, coalesce(sa.created_at, s.created_at)
from public.subscriptions s
join public.products p on p.id = s.product_id and p.slug = 'chatgpt_private'
join public.service_accounts sa on sa.id = s.service_account_id
where not exists (
  select 1 from public.subscription_account_history h where h.subscription_id = s.id
);

update public.subscription_account_history h
set purchase_cost_bob = totals.bob, purchase_cost_usdt = totals.usdt
from (
  select service_account_id, coalesce(sum(amount_bob), 0) bob, coalesce(sum(amount_usdt), 0) usdt
  from public.costs group by service_account_id
) totals
where totals.service_account_id = h.service_account_id;
