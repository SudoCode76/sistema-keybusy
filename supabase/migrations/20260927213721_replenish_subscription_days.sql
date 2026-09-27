alter table public.billing_cycles
  add column extra_days integer not null default 0
  check (extra_days >= 0);

create or replace function public.replenish_subscription_days(
  p_subscription_id uuid,
  p_days integer
)
returns date
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_sale public.subscriptions%rowtype;
  current_cycle public.billing_cycles%rowtype;
  next_end date;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Ingresa una cantidad de días entre 1 y 365';
  end if;

  select * into current_sale
  from public.subscriptions
  where id = p_subscription_id
  for update;
  if not found or current_sale.status in ('canceled', 'inactive') then
    raise exception 'No se encontró un acceso vigente para reponer días';
  end if;

  select * into current_cycle
  from public.billing_cycles
  where subscription_id = p_subscription_id
    and period_end = current_sale.ends_on
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'No se encontró el período actual del acceso';
  end if;

  next_end := current_sale.ends_on + p_days;
  update public.subscriptions
  set ends_on = next_end, updated_at = now()
  where id = p_subscription_id;
  update public.billing_cycles
  set period_end = next_end,
      extra_days = extra_days + p_days,
      updated_at = now()
  where id = current_cycle.id;

  return next_end;
end;
$$;

revoke all on function public.replenish_subscription_days(uuid, integer)
  from public, anon;
grant execute on function public.replenish_subscription_days(uuid, integer)
  to authenticated;

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.update_sale(uuid, jsonb)'::regprocedure)
  into function_definition;

  if position('  current_cycle_id uuid;' in function_definition) = 0
    or position('ends_on := starts_on + (duration_months * interval ''1 month'');' in function_definition) = 0
    or position('select s.customer_id, s.product_id, s.service_account_id, s.slot_label' in function_definition) = 0 then
    raise exception 'Expected update_sale markers were not found';
  end if;

  function_definition := replace(
    function_definition,
    '  current_cycle_id uuid;',
    E'  current_cycle_id uuid;\n  extra_days integer := 0;'
  );
  function_definition := replace(
    function_definition,
    '  ends_on := starts_on + (duration_months * interval ''1 month'');',
    E'  select coalesce(bc.extra_days, 0) into extra_days from public.billing_cycles bc join public.subscriptions s on s.id = bc.subscription_id where bc.subscription_id = p_subscription_id and bc.period_end = current_sale.ends_on order by bc.created_at desc limit 1;\n  ends_on := starts_on + (duration_months * interval ''1 month'') + (coalesce(extra_days, 0) * interval ''1 day'');'
  );
  function_definition := replace(
    function_definition,
    'select s.customer_id, s.product_id, s.service_account_id, s.slot_label',
    'select s.customer_id, s.product_id, s.service_account_id, s.slot_label, s.ends_on'
  );

  execute function_definition;
end;
$migration$;
