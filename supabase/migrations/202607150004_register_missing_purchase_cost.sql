create or replace function public.register_missing_purchase_cost(
  p_subscription_id uuid,
  p_exchange_rate numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sale_row record;
  existing_cost_id uuid;
  amount_bob numeric;
  amount_usdt numeric;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  if p_exchange_rate is null or p_exchange_rate <= 0 then
    raise exception 'Tipo de cambio invalido';
  end if;

  select
    s.id,
    s.starts_on,
    s.service_account_id,
    p.purchase_mode,
    p.default_purchase_amount,
    p.default_purchase_currency,
    sa.provider_id
  into sale_row
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  left join public.service_accounts sa on sa.id = s.service_account_id
  where s.id = p_subscription_id
  for update of s;

  if sale_row.id is null then
    raise exception 'Venta no encontrada';
  end if;

  if sale_row.purchase_mode <> 'individual' or sale_row.service_account_id is null then
    raise exception 'La venta no corresponde a una cuenta privada enlazada';
  end if;

  if coalesce(sale_row.default_purchase_amount, 0) <= 0 then
    raise exception 'El catalogo no tiene un precio de compra valido';
  end if;

  select id
  into existing_cost_id
  from public.costs
  where subscription_id = p_subscription_id
    and cost_type = 'purchase'
  limit 1;

  if existing_cost_id is not null then
    return false;
  end if;

  if sale_row.default_purchase_currency = 'BOB' then
    amount_bob := sale_row.default_purchase_amount;
    amount_usdt := sale_row.default_purchase_amount / p_exchange_rate;
  else
    amount_usdt := sale_row.default_purchase_amount;
    amount_bob := sale_row.default_purchase_amount * p_exchange_rate;
  end if;

  update public.service_accounts
  set
    base_cost_amount = sale_row.default_purchase_amount,
    base_cost_currency = sale_row.default_purchase_currency,
    base_cost_exchange_rate = p_exchange_rate,
    base_cost_bob = amount_bob,
    base_cost_usdt = amount_usdt
  where id = sale_row.service_account_id;

  insert into public.costs(
    service_account_id,
    provider_id,
    subscription_id,
    cost_type,
    paid_at,
    amount,
    currency,
    exchange_rate,
    amount_bob,
    amount_usdt,
    notes
  ) values (
    sale_row.service_account_id,
    sale_row.provider_id,
    p_subscription_id,
    'purchase',
    sale_row.starts_on::timestamptz,
    sale_row.default_purchase_amount,
    sale_row.default_purchase_currency,
    p_exchange_rate,
    amount_bob,
    amount_usdt,
    'Costo de compra registrado posteriormente'
  );

  return true;
end;
$$;

revoke all on function public.register_missing_purchase_cost(uuid, numeric)
from public, anon;

grant execute on function public.register_missing_purchase_cost(uuid, numeric)
to authenticated;
