create or replace function public.update_sale(
  p_subscription_id uuid,
  p_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
#variable_conflict use_variable
<<edit>>
declare
  current_sale record;
  old_product record;
  product_row record;
  account_row record;
  customer_phone text := nullif(btrim(p_values ->> 'phone'), '');
  normalized_phone text;
  telegram_username text := public.normalize_telegram_username(p_values ->> 'telegram_username');
  country_id uuid := nullif(p_values ->> 'country_id', '')::uuid;
  phone_e164 text;
  phone_owner uuid;
  telegram_owner uuid;
  account_id uuid := nullif(p_values ->> 'service_account_id', '')::uuid;
  provider_id uuid := nullif(p_values ->> 'provider_id', '')::uuid;
  email_address_id uuid := nullif(p_values ->> 'email_address_id', '')::uuid;
  email_provider_id uuid := nullif(p_values ->> 'email_provider_id', '')::uuid;
  managed_email_mode text := nullif(p_values ->> 'managed_email_mode', '');
  email_origin text := case
    when p_values ->> 'email_origin' = 'provider' then 'provider'
    else 'self'
  end;
  product_id uuid := nullif(p_values ->> 'product_id', '')::uuid;
  duration_months integer := coalesce((p_values ->> 'duration_months')::integer, 1);
  starts_on date := (p_values ->> 'starts_on')::date;
  ends_on date;
  price_amount numeric := coalesce((p_values ->> 'price_amount')::numeric, 0);
  price_currency public.currency_code := (p_values ->> 'price_currency')::public.currency_code;
  exchange_rate numeric := nullif(p_values ->> 'exchange_rate', '')::numeric;
  purchase_amount numeric := coalesce((p_values ->> 'purchase_amount')::numeric, 0);
  purchase_currency public.currency_code := coalesce(
    nullif(p_values ->> 'purchase_currency', '')::public.currency_code,
    'USDT'::public.currency_code
  );
  purchase_exchange_rate numeric := nullif(p_values ->> 'purchase_exchange_rate', '')::numeric;
  sale_bob numeric := 0;
  sale_usdt numeric := 0;
  purchase_bob numeric := 0;
  purchase_usdt numeric := 0;
  initial_cycle_id uuid;
  initial_payment_id uuid;
  purchase_cost_id uuid;
  current_usage record;
  visible_fields text[];
  profile_label text := nullif(btrim(p_values ->> 'profile_label'), '');
  login_email text := nullif(btrim(p_values ->> 'login_email'), '');
  login_password text := nullif(p_values ->> 'login_password', '');
  email_password text := nullif(p_values ->> 'email_password', '');
  invitation_email text := nullif(btrim(p_values ->> 'invitation_email'), '');
  account_email text;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  select s.customer_id, s.product_id, s.service_account_id
  into current_sale
  from public.subscriptions s
  where s.id = p_subscription_id
  for update;

  if current_sale.customer_id is null then
    raise exception 'Venta no encontrada';
  end if;

  select id, service_id
  into old_product
  from public.products
  where id = current_sale.product_id;

  select id, service_id, name, purchase_mode, slug
  into product_row
  from public.products
  where id = edit.product_id
    and status = 'active';

  if product_row.id is null then
    raise exception 'Item vendible invalido';
  end if;

  if product_row.service_id <> old_product.service_id then
    raise exception 'No se puede cambiar la plataforma desde Editar';
  end if;

  normalized_phone := public.normalize_phone(customer_phone);
  if normalized_phone is null and telegram_username is null then
    raise exception 'Ingresa un telefono o un usuario de Telegram';
  end if;

  if telegram_username is not null
    and telegram_username !~ '^[a-z0-9_]{5,32}$' then
    raise exception 'Telegram debe tener entre 5 y 32 letras, numeros o guion bajo';
  end if;

  if normalized_phone is not null then
    if country_id is null
      or not exists (
        select 1 from public.countries
        where id = country_id and status = 'active'
      ) then
      raise exception 'Pais invalido';
    end if;
    phone_e164 := public.to_e164(country_id, customer_phone);

    select id into phone_owner
    from public.customers
    where customers.phone_e164 = edit.phone_e164
      and id <> current_sale.customer_id
    limit 1;
  else
    country_id := null;
  end if;

  if telegram_username is not null then
    select id into telegram_owner
    from public.customers
    where customers.telegram_username = edit.telegram_username
      and id <> current_sale.customer_id
    limit 1;
  end if;

  if phone_owner is not null or telegram_owner is not null then
    raise exception 'El telefono o Telegram pertenece a otro cliente';
  end if;

  update public.customers
  set
    phone = customer_phone,
    phone_normalized = normalized_phone,
    phone_e164 = phone_e164,
    country_id = country_id,
    telegram_username = telegram_username,
    updated_at = now()
  where id = current_sale.customer_id;

  if duration_months < 1 then
    raise exception 'La duracion debe ser de al menos 1 mes';
  end if;
  if price_amount < 0 or purchase_amount < 0 then
    raise exception 'Los precios no pueden ser negativos';
  end if;

  ends_on := starts_on + (duration_months * interval '1 month');

  if price_currency = 'BOB' then
    sale_bob := price_amount;
    sale_usdt := case
      when exchange_rate > 0 then price_amount / exchange_rate
      else 0
    end;
  else
    sale_usdt := price_amount;
    sale_bob := case
      when exchange_rate > 0 then price_amount * exchange_rate
      else 0
    end;
  end if;

  if purchase_currency = 'BOB' then
    purchase_bob := purchase_amount;
    purchase_usdt := case
      when purchase_exchange_rate > 0 then purchase_amount / purchase_exchange_rate
      else 0
    end;
  else
    purchase_usdt := purchase_amount;
    purchase_bob := case
      when purchase_exchange_rate > 0 then purchase_amount * purchase_exchange_rate
      else 0
    end;
  end if;

  if provider_id is not null
    and not exists (
      select 1
      from public.provider_services
      where provider_services.provider_id = edit.provider_id
        and service_id = product_row.service_id
    ) then
    raise exception 'El proveedor no pertenece a esta plataforma';
  end if;

  if managed_email_mode = 'existing' then
    if email_address_id is null
      or not exists (
        select 1 from public.email_addresses
        where id = edit.email_address_id
          and status = 'active'
      ) then
      raise exception 'El correo seleccionado no esta disponible';
    end if;
  elsif managed_email_mode = 'new' and login_email is not null then
    insert into public.email_addresses(
      email,
      email_password,
      origin,
      provider_id
    )
    values (
      edit.login_email,
      edit.email_password,
      edit.email_origin,
      case when edit.email_origin = 'provider' then edit.email_provider_id end
    )
    returning id into edit.email_address_id;
  end if;

  if email_address_id is not null and email_password is not null then
    update public.email_addresses
    set email_password = edit.email_password,
        updated_at = now()
    where id = edit.email_address_id;
  end if;

  if account_id is not null then
    select id, service_id, status
    into account_row
    from public.service_accounts
    where id = edit.account_id
    for update;

    if account_row.id is null
      or account_row.status <> 'active'
      or account_row.service_id <> product_row.service_id then
      raise exception 'La cuenta elegida no esta disponible para este item';
    end if;
  elsif product_row.purchase_mode = 'individual' then
    insert into public.service_accounts(
      service_id,
      edit.provider_id,
      edit.email_address_id,
      label,
      login_email,
      base_cost_amount,
      base_cost_currency,
      base_cost_exchange_rate,
      base_cost_bob,
      base_cost_usdt,
      two_factor_url,
      notes
    )
    values (
      product_row.service_id,
      provider_id,
      email_address_id,
      coalesce(
        nullif(btrim(p_values ->> 'account_label'), ''),
        edit.login_email,
        edit.invitation_email,
        product_row.name
      ),
      coalesce(edit.login_email, edit.invitation_email),
      purchase_amount,
      purchase_currency,
      purchase_exchange_rate,
      purchase_bob,
      purchase_usdt,
      nullif(btrim(p_values ->> 'two_factor_url'), ''),
      nullif(btrim(p_values ->> 'notes'), '')
    )
    returning id into account_id;
  elsif product_row.purchase_mode = 'linked' then
    raise exception 'Este item requiere una cuenta enlazada';
  end if;

  if product_row.purchase_mode = 'individual' and account_id is not null then
    if exists (
      select 1
      from public.subscriptions
      where service_account_id = edit.account_id
        and id <> p_subscription_id
        and status not in ('canceled', 'inactive')
    ) then
      raise exception 'Esta cuenta ya esta enlazada a otra venta activa';
    end if;

    update public.service_accounts
    set
      provider_id = edit.provider_id,
      email_address_id = coalesce(edit.email_address_id, service_accounts.email_address_id),
      label = coalesce(
        nullif(btrim(p_values ->> 'account_label'), ''),
        service_accounts.label
      ),
      login_email = coalesce(
        edit.login_email,
        edit.invitation_email,
        service_accounts.login_email
      ),
      base_cost_amount = purchase_amount,
      base_cost_currency = purchase_currency,
      base_cost_exchange_rate = purchase_exchange_rate,
      base_cost_bob = purchase_bob,
      base_cost_usdt = purchase_usdt,
      two_factor_url = nullif(btrim(p_values ->> 'two_factor_url'), ''),
      notes = nullif(btrim(p_values ->> 'notes'), ''),
      updated_at = now()
    where id = edit.account_id;

    if nullif(p_values ->> 'secret_payload', '') is not null then
      insert into public.account_credentials(service_account_id, secret_payload)
      values (edit.account_id, p_values ->> 'secret_payload')
      on conflict (service_account_id)
      do update set
        secret_payload = excluded.secret_payload,
        updated_at = now();
    end if;

    select id into purchase_cost_id
    from public.costs
    where subscription_id = p_subscription_id
      and cost_type = 'purchase'
    order by created_at
    limit 1;

    if purchase_amount > 0 then
      if purchase_cost_id is null then
        insert into public.costs(
          service_account_id,
          provider_id,
          subscription_id,
          cost_type,
          amount,
          currency,
          exchange_rate,
          amount_bob,
          amount_usdt,
          notes
        )
        values (
          edit.account_id,
          edit.provider_id,
          p_subscription_id,
          'purchase',
          purchase_amount,
          purchase_currency,
          purchase_exchange_rate,
          purchase_bob,
          purchase_usdt,
          nullif(btrim(p_values ->> 'notes'), '')
        );
      else
        update public.costs
        set
          service_account_id = edit.account_id,
          provider_id = edit.provider_id,
          amount = purchase_amount,
          currency = purchase_currency,
          exchange_rate = purchase_exchange_rate,
          amount_bob = purchase_bob,
          amount_usdt = purchase_usdt,
          notes = nullif(btrim(p_values ->> 'notes'), '')
        where id = purchase_cost_id;
      end if;
    else
      delete from public.costs
      where subscription_id = p_subscription_id
        and cost_type = 'purchase';
    end if;
  end if;

  if product_row.slug = 'spotify_family_member' then
    profile_label := case
      when profile_label = 'Titular' then 'Titular'
      else 'Miembro familiar'
    end;

    if account_id is null
      or not exists (
        select 1 from public.spotify_family_plans
        where service_account_id = edit.account_id
      ) then
      raise exception 'Spotify requiere un plan familiar enlazado';
    end if;
  end if;

  update public.subscriptions
  set
    product_id = edit.product_id,
    service_account_id = edit.account_id,
    slot_label = edit.profile_label,
    starts_on = edit.starts_on,
    ends_on = edit.ends_on,
    duration_months = edit.duration_months,
    current_price_amount = edit.price_amount,
    current_price_currency = edit.price_currency,
    current_exchange_rate = edit.exchange_rate,
    notes = nullif(btrim(p_values ->> 'notes'), ''),
    updated_at = now()
  where id = p_subscription_id;

  select id into initial_cycle_id
  from public.billing_cycles
  where subscription_id = p_subscription_id
  order by created_at, period_start
  limit 1;

  if initial_cycle_id is not null then
    update public.billing_cycles
    set
      period_start = edit.starts_on,
      period_end = edit.ends_on,
      due_on = edit.starts_on,
      expected_amount = edit.price_amount,
      expected_currency = edit.price_currency,
      exchange_rate = edit.exchange_rate,
      expected_bob = sale_bob,
      expected_usdt = sale_usdt,
      updated_at = now()
    where id = initial_cycle_id;
  end if;

  select id into initial_payment_id
  from public.payments
  where subscription_id = p_subscription_id
    and payment_type = 'new'
  order by created_at, paid_at
  limit 1;

  if initial_payment_id is not null then
    update public.payments
    set
      customer_id = current_sale.customer_id,
      billing_cycle_id = coalesce(initial_cycle_id, billing_cycle_id),
      amount = edit.price_amount,
      currency = edit.price_currency,
      exchange_rate = edit.exchange_rate,
      amount_bob = sale_bob,
      amount_usdt = sale_usdt
    where id = initial_payment_id;
  end if;

  visible_fields := array_remove(array[
    case when login_email is not null then 'login_email' end,
    case when login_password is not null then 'login_password' end,
    case when email_password is not null then 'email_password' end,
    case when invitation_email is not null then 'invitation_email' end,
    case when profile_label is not null then 'profile_label' end,
    case when nullif(btrim(p_values ->> 'access_notes'), '') is not null then 'notes' end
  ]::text[], null);

  insert into public.subscription_access_details(
    subscription_id,
    login_email,
    login_password,
    email_password,
    invitation_email,
    profile_label,
    notes,
    visible_to_customer,
    visible_fields
  )
  values (
    p_subscription_id,
    edit.login_email,
    edit.login_password,
    edit.email_password,
    edit.invitation_email,
    edit.profile_label,
    nullif(btrim(p_values ->> 'access_notes'), ''),
    true,
    visible_fields
  )
  on conflict (subscription_id)
  do update set
    login_email = excluded.login_email,
    login_password = excluded.login_password,
    email_password = excluded.email_password,
    invitation_email = excluded.invitation_email,
    profile_label = excluded.profile_label,
    notes = excluded.notes,
    visible_to_customer = true,
    visible_fields = excluded.visible_fields,
    updated_at = now();

  select email_usages.id, email_usages.email_address_id
  into current_usage
  from public.email_usages
  where subscription_id = p_subscription_id
    and ended_at is null
  order by started_at desc
  limit 1;

  if current_usage.id is not null
    and current_usage.email_address_id is distinct from edit.email_address_id then
    update public.email_usages
    set ended_at = now()
    where id = current_usage.id;
  end if;

  if edit.email_address_id is not null then
    if current_usage.id is not null
      and current_usage.email_address_id = edit.email_address_id then
      update public.email_usages
      set
        purpose = product_row.name,
        platform_password = coalesce(login_password, platform_password)
      where id = current_usage.id;
    else
      insert into public.email_usages(
        email_address_id,
        service_account_id,
        subscription_id,
        purpose,
        platform_password
      )
      values (
        edit.email_address_id,
        case when product_row.purchase_mode = 'individual' then edit.account_id end,
        p_subscription_id,
        product_row.name,
        login_password
      );
    end if;
  end if;

  return edit.account_id;
end;
$$;

revoke all on function public.update_sale(uuid, jsonb) from public, anon;
grant execute on function public.update_sale(uuid, jsonb) to authenticated;
