create or replace view public.admin_monthly_renewal_comparison
with (security_invoker = true)
as
with bounds as (
  select
    timezone('America/La_Paz', now())::date as today,
    date_trunc('month', timezone('America/La_Paz', now()))::date as month_start
),
due_cycles as (
  select distinct on (cycle.subscription_id)
    cycle.subscription_id,
    exists (
      select 1
      from public.billing_cycles next_cycle
      join public.payments renewal on renewal.billing_cycle_id = next_cycle.id
      cross join bounds b
      where next_cycle.subscription_id = cycle.subscription_id
        and next_cycle.created_at > cycle.created_at
        and next_cycle.status = 'paid'
        and renewal.payment_type = 'renewal'
        and (renewal.paid_at at time zone 'America/La_Paz')::date <= b.today
    ) as renewed
  from public.billing_cycles cycle
  cross join bounds b
  where cycle.status = 'paid'
    and cycle.period_end between b.month_start and b.today
    and exists (
      select 1
      from public.payments payment
      where payment.billing_cycle_id = cycle.id
        and payment.payment_type in ('new', 'renewal')
        and (payment.paid_at at time zone 'America/La_Paz')::date <= b.today
    )
  order by cycle.subscription_id, cycle.period_end desc, cycle.created_at desc
),
renewal_counts as (
  select
    count(*) filter (where renewed)::integer as renewed_count,
    count(*) filter (where not renewed)::integer as not_renewed_count
  from due_cycles
),
new_sales as (
  select count(distinct payment.subscription_id)::integer as new_sales_count
  from public.payments payment
  join public.billing_cycles cycle on cycle.id = payment.billing_cycle_id
  cross join bounds b
  where payment.payment_type = 'new'
    and cycle.period_start between b.month_start and b.today
    and (payment.paid_at at time zone 'America/La_Paz')::date <= b.today
)
select
  b.month_start,
  b.today as as_of,
  r.renewed_count,
  r.not_renewed_count,
  n.new_sales_count
from bounds b
cross join renewal_counts r
cross join new_sales n;

revoke all on public.admin_monthly_renewal_comparison from public, anon;
grant select on public.admin_monthly_renewal_comparison to authenticated;
