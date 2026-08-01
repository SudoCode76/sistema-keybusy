create or replace view public.admin_daily_sales_trends
with (security_invoker = true)
as
with bounds as (
  select
    timezone('America/La_Paz', now())::date as today,
    date_trunc('month', timezone('America/La_Paz', now()))::date as month_start
),
days as (
  select generate_series(b.month_start, b.today, interval '1 day')::date as day
  from bounds b
),
sales as (
  select
    cycle.period_start as day,
    sv.id as service_id,
    sv.slug as service_slug,
    sv.name as service_name,
    count(*) filter (where pay.payment_type = 'new')::integer as new_sales,
    count(*) filter (where pay.payment_type = 'renewal')::integer as renewal_sales
  from public.payments pay
  join public.billing_cycles cycle on cycle.id = pay.billing_cycle_id
  join public.subscriptions sub on sub.id = pay.subscription_id
  join public.products product on product.id = sub.product_id
  join public.services sv on sv.id = product.service_id
  cross join bounds b
  where sv.status = 'active'
    and pay.payment_type in ('new', 'renewal')
    and cycle.period_start between b.month_start and b.today
  group by 1, 2, 3, 4
),
services_with_sales as (
  select distinct service_id, service_slug, service_name
  from sales
)
select
  d.day,
  sv.service_slug,
  sv.service_name,
  coalesce(s.new_sales, 0)::integer as new_sales,
  coalesce(s.renewal_sales, 0)::integer as renewal_sales,
  (coalesce(s.new_sales, 0) + coalesce(s.renewal_sales, 0))::integer
    as total_sales
from days d
cross join services_with_sales sv
left join sales s on s.day = d.day and s.service_id = sv.service_id
order by d.day, sv.service_name;
