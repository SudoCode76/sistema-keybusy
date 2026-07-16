do $$
declare
  sale_row record;
  product_row record;
  exchange_rate constant numeric := 10.6985;
  amount_bob numeric;
begin
  select
    id,
    purchase_mode,
    default_purchase_amount,
    default_purchase_currency
  into product_row
  from public.products
  where slug = 'super_grok_privado';

  if product_row.id is null
    or product_row.purchase_mode <> 'individual'
    or product_row.default_purchase_amount <> 6
    or product_row.default_purchase_currency <> 'USDT' then
    raise exception 'Super Grok debe estar configurado como individual con compra de 6 USDT';
  end if;

  insert into public.exchange_rate_snapshots(
    trade_type,
    rows_requested,
    average_price,
    raw_ads
  ) values (
    'BUY',
    20,
    exchange_rate,
    '[]'::jsonb
  );

  for sale_row in
    select
      s.id,
      s.starts_on,
      s.service_account_id,
      sa.provider_id
    from public.subscriptions s
    join public.service_accounts sa on sa.id = s.service_account_id
    where s.product_id = product_row.id
      and not exists (
        select 1
        from public.costs c
        where c.subscription_id = s.id
          and c.cost_type = 'purchase'
      )
    order by s.starts_on, s.id
    for update of s
  loop
    amount_bob := product_row.default_purchase_amount * exchange_rate;

    update public.service_accounts
    set
      base_cost_amount = product_row.default_purchase_amount,
      base_cost_currency = product_row.default_purchase_currency,
      base_cost_exchange_rate = exchange_rate,
      base_cost_bob = amount_bob,
      base_cost_usdt = product_row.default_purchase_amount
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
      sale_row.id,
      'purchase',
      sale_row.starts_on::timestamptz,
      product_row.default_purchase_amount,
      product_row.default_purchase_currency,
      exchange_rate,
      amount_bob,
      product_row.default_purchase_amount,
      'Costo histórico Super Grok registrado posteriormente'
    );
  end loop;
end;
$$;
