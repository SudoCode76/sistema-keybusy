do $$
declare
  product_row record;
  sale_row record;
  new_account_id uuid;
  secret_payload text;
begin
  select
    id,
    service_id,
    default_purchase_amount,
    default_purchase_currency,
    default_purchase_exchange_rate
  into product_row
  from public.products
  where slug = 'super_grok_privado';

  if product_row.id is null then
    raise exception 'No existe el producto super_grok_privado';
  end if;

  update public.products
  set purchase_mode = 'individual'
  where id = product_row.id
    and purchase_mode <> 'individual';

  for sale_row in
    select
      s.id,
      s.starts_on,
      s.created_at,
      sad.login_email,
      sad.login_password,
      sad.email_password,
      eu.email_address_id
    from public.subscriptions s
    join public.subscription_access_details sad on sad.subscription_id = s.id
    left join public.email_usages eu
      on eu.subscription_id = s.id
     and eu.ended_at is null
    where s.product_id = product_row.id
      and s.service_account_id is null
  loop
    if nullif(btrim(sale_row.login_email), '') is null then
      raise exception 'La suscripcion % no tiene correo para crear su inventario', sale_row.id;
    end if;

    insert into public.service_accounts(
      service_id,
      email_address_id,
      label,
      login_email,
      base_cost_amount,
      base_cost_currency,
      base_cost_exchange_rate,
      base_cost_bob,
      base_cost_usdt,
      started_at,
      created_at
    ) values (
      product_row.service_id,
      sale_row.email_address_id,
      btrim(sale_row.login_email),
      btrim(sale_row.login_email),
      coalesce(product_row.default_purchase_amount, 0),
      coalesce(product_row.default_purchase_currency, 'USDT'),
      product_row.default_purchase_exchange_rate,
      case
        when product_row.default_purchase_currency = 'BOB'
          then coalesce(product_row.default_purchase_amount, 0)
        when product_row.default_purchase_exchange_rate > 0
          then coalesce(product_row.default_purchase_amount, 0) * product_row.default_purchase_exchange_rate
        else 0
      end,
      case
        when product_row.default_purchase_currency = 'USDT'
          then coalesce(product_row.default_purchase_amount, 0)
        when product_row.default_purchase_exchange_rate > 0
          then coalesce(product_row.default_purchase_amount, 0) / product_row.default_purchase_exchange_rate
        else 0
      end,
      sale_row.starts_on::timestamptz,
      sale_row.created_at
    )
    returning id into new_account_id;

    secret_payload := concat_ws(
      E'\n',
      case
        when nullif(sale_row.login_password, '') is not null
          then 'password: ' || sale_row.login_password
      end,
      case
        when nullif(sale_row.email_password, '') is not null
          then 'email_password: ' || sale_row.email_password
      end
    );

    if secret_payload <> '' then
      insert into public.account_credentials(service_account_id, secret_payload)
      values (new_account_id, secret_payload);
    end if;

    update public.subscriptions
    set service_account_id = new_account_id
    where id = sale_row.id;

    update public.email_usages
    set service_account_id = new_account_id
    where subscription_id = sale_row.id
      and ended_at is null;
  end loop;
end;
$$;
