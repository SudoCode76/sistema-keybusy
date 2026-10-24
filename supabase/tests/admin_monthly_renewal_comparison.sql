-- Run only in a disposable database; these minimal tables exercise the view SQL.
create role anon;
create role authenticated;

create table public.subscriptions (
  id integer primary key,
  status text not null
);

create table public.billing_cycles (
  id integer primary key,
  subscription_id integer not null references public.subscriptions(id),
  period_start date not null,
  period_end date not null,
  status text not null,
  created_at timestamptz not null
);

create table public.payments (
  id integer primary key,
  subscription_id integer not null,
  customer_id integer not null,
  billing_cycle_id integer not null references public.billing_cycles(id),
  payment_type text not null,
  paid_at timestamptz not null
);

\ir ../migrations/202610200001_admin_monthly_renewal_comparison.sql

insert into public.subscriptions (id, status)
select id, case when id = 4 then 'canceled' else 'active' end
from generate_series(1, 10) as id;

with bounds as (
  select
    timezone('America/La_Paz', now())::date as today,
    date_trunc('month', timezone('America/La_Paz', now()))::date as month_start
)
insert into public.billing_cycles
  (id, subscription_id, period_start, period_end, status, created_at)
select cycle.*
from bounds b
cross join lateral (values
  (1, 1, b.month_start - 30, b.today, 'paid', now() - interval '20 days'),
  (2, 1, b.today, b.today + 30, 'paid', now() - interval '1 day'),
  (3, 2, b.month_start - 30, b.today, 'paid', now() - interval '20 days'),
  (4, 3, b.month_start - 30, b.today, 'paid', now() - interval '20 days'),
  (5, 3, b.today, b.today + 30, 'paid', now() - interval '2 days'),
  (6, 4, b.month_start - 30, b.today, 'paid', now() - interval '20 days'),
  (7, 5, b.month_start, b.today + 1, 'paid', now() - interval '5 days'),
  (8, 6, b.month_start - 30, b.month_start - 1, 'paid', now() - interval '35 days'),
  (9, 7, b.month_start, b.today + 30, 'paid', now() - interval '1 day'),
  (10, 8, b.month_start, b.today + 30, 'paid', now() - interval '1 day'),
  (11, 9, b.month_start - 30, b.today, 'pending', now() - interval '20 days'),
  (12, 10, b.month_start - 30, b.today, 'paid', now() - interval '20 days'),
  (13, 10, b.today, b.today, 'paid', now() - interval '1 day')
) as cycle(id, subscription_id, period_start, period_end, status, created_at);

-- Subscription 4 was canceled; its paid period still counts once it expires.
-- Subscriptions 7 and 8 are new sales to customer 20, who already owned 2.
insert into public.payments
  (id, subscription_id, customer_id, billing_cycle_id, payment_type, paid_at)
values
  (1, 1, 10, 1, 'new', now() - interval '20 days'),
  (2, 1, 10, 2, 'renewal', now()),
  (3, 2, 20, 3, 'new', now() - interval '20 days'),
  (4, 3, 30, 4, 'new', now() - interval '20 days'),
  (5, 3, 30, 5, 'renewal', now() - interval '2 days'),
  (6, 4, 40, 6, 'new', now() - interval '20 days'),
  (7, 5, 50, 7, 'new', now() - interval '5 days'),
  (8, 6, 60, 8, 'new', now() - interval '35 days'),
  (9, 7, 20, 9, 'new', now()),
  (10, 8, 20, 10, 'new', now()),
  (11, 10, 70, 12, 'new', now() - interval '20 days'),
  (12, 10, 70, 13, 'renewal', now()),
  (13, 7, 20, 9, 'new', now());

do $$
declare
  result record;
begin
  select * into result from public.admin_monthly_renewal_comparison;
  if result.renewed_count <> 2
     or result.not_renewed_count <> 3
     or result.new_sales_count <> 3 then
    raise exception 'Expected renewed=2, not_renewed=3, new=3; got %, %, %',
      result.renewed_count, result.not_renewed_count, result.new_sales_count;
  end if;
end;
$$;

truncate public.payments, public.billing_cycles;

do $$
declare
  result record;
begin
  select * into result from public.admin_monthly_renewal_comparison;
  if result.renewed_count <> 0
     or result.not_renewed_count <> 0
     or result.new_sales_count <> 0 then
    raise exception 'Empty database must return zero counts';
  end if;
end;
$$;
