create or replace view public.subscription_status_view
with (security_invoker = true)
as
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
    when s.ends_on <= timezone('America/La_Paz', now())::date then 'expired'
    when s.ends_on <= timezone('America/La_Paz', now())::date + 7 then 'pending_renewal'
    else 'active'
  end as computed_status,
  s.current_price_amount,
  s.current_price_currency
from public.subscriptions s
join public.customers c on c.id = s.customer_id
join public.products p on p.id = s.product_id
join public.services sv on sv.id = p.service_id
left join public.service_accounts sa on sa.id = s.service_account_id;
