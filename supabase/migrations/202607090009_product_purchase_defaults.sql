alter table public.products
add column if not exists purchase_mode text not null default 'inventory'
  check (purchase_mode in ('inventory', 'individual', 'linked')),
add column if not exists default_purchase_amount numeric(12, 2) not null default 0
  check (default_purchase_amount >= 0),
add column if not exists default_purchase_currency public.currency_code not null default 'USDT',
add column if not exists default_purchase_exchange_rate numeric(12, 6)
  check (default_purchase_exchange_rate is null or default_purchase_exchange_rate > 0);

alter table public.costs
add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null;

create index if not exists costs_subscription_id_idx on public.costs(subscription_id);

update public.products
set purchase_mode = 'inventory'
where slug in ('netflix_profile', 'spotify_family_member', 'chatgpt_shared');

update public.products
set purchase_mode = 'linked'
where slug = 'chatgpt_codex';

update public.products
set purchase_mode = 'individual'
where slug in ('chatgpt_private', 'canva_profile', 'disney_profile', 'hbo_profile', 'hbo_max_profile');
