create or replace view public.admin_dashboard_summary
with (security_invoker = true)
as
with bounds as (
  select
    timezone('America/La_Paz', now())::date as today,
    date_trunc('month', timezone('America/La_Paz', now()))::date as month_start,
    (date_trunc('month', timezone('America/La_Paz', now())) + interval '1 month')::date as next_month_start
),
collected as (
  select
    coalesce(sum(p.amount_bob), 0)::numeric(12, 2) as collected_bob,
    coalesce(sum(p.amount_usdt), 0)::numeric(12, 2) as collected_usdt,
    count(*) filter (where p.payment_type = 'new')::integer as collected_new_count,
    count(*) filter (where p.payment_type = 'renewal')::integer as collected_renewal_count,
    count(*) filter (where p.payment_type = 'adjustment')::integer as collected_adjustment_count
  from public.payments p
  cross join bounds b
  where (p.paid_at at time zone 'America/La_Paz')::date between b.month_start and b.today
),
renewal_candidates as (
  select
    s.ends_on,
    case
      when s.current_price_currency = 'BOB'
        then round(s.current_price_amount * s.duration_months, 2)
      when s.current_exchange_rate > 0
        then round(s.current_price_amount * s.duration_months * s.current_exchange_rate, 2)
      else 0
    end as amount_bob,
    case
      when s.current_price_currency = 'USDT'
        then round(s.current_price_amount * s.duration_months, 2)
      when s.current_exchange_rate > 0
        then round(s.current_price_amount * s.duration_months / s.current_exchange_rate, 2)
      else 0
    end as amount_usdt
  from public.subscriptions s
  cross join bounds b
  where s.status = 'active'
    and s.ends_on >= b.month_start
    and s.ends_on < b.next_month_start
),
pending as (
  select
    coalesce(sum(r.amount_bob), 0)::numeric(12, 2) as pending_bob,
    coalesce(sum(r.amount_usdt), 0)::numeric(12, 2) as pending_usdt,
    count(*)::integer as pending_renewal_count
  from renewal_candidates r
  cross join bounds b
  where r.ends_on > b.today
),
overdue as (
  select
    coalesce(sum(r.amount_bob), 0)::numeric(12, 2) as overdue_bob,
    coalesce(sum(r.amount_usdt), 0)::numeric(12, 2) as overdue_usdt,
    count(*)::integer as overdue_renewal_count
  from renewal_candidates r
  cross join bounds b
  where r.ends_on <= b.today
)
select
  b.month_start as month,
  b.today as as_of,
  (b.today + 1) as pending_from,
  (b.next_month_start - 1) as month_end,
  c.collected_bob,
  c.collected_usdt,
  c.collected_new_count,
  c.collected_renewal_count,
  c.collected_adjustment_count,
  p.pending_bob,
  p.pending_usdt,
  p.pending_renewal_count,
  (c.collected_bob + p.pending_bob)::numeric(12, 2) as projected_bob,
  (c.collected_usdt + p.pending_usdt)::numeric(12, 2) as projected_usdt,
  o.overdue_bob,
  o.overdue_usdt,
  o.overdue_renewal_count
from bounds b
cross join collected c
cross join pending p
cross join overdue o;
