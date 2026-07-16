create or replace function public.create_sale(
  p_phone text,
  p_product_slug text,
  p_service_account_id uuid default null,
  p_provider_id uuid default null,
  p_login_email text default null,
  p_login_password text default null,
  p_email_password text default null,
  p_invitation_email text default null,
  p_profile_label text default null,
  p_customer_name text default null,
  p_account_label text default null,
  p_starts_on date default current_date,
  p_duration_months integer default 1,
  p_price_amount numeric default null,
  p_price_currency public.currency_code default null,
  p_exchange_rate numeric default null,
  p_paid_now boolean default false,
  p_visible_to_customer boolean default false,
  p_visible_fields text[] default '{}',
  p_notes text default null,
  p_country_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_phone text;
  customer_id uuid;
  product_row record;
  selected_account record;
  account_id uuid;
  subscription_id uuid;
  cycle_id uuid;
  ends_on date;
  amount_bob numeric := 0;
  amount_usdt numeric := 0;
  detail_fields text[];
  country_row record;
  customer_phone_e164 text;
  sale_price_amount numeric;
  sale_price_currency public.currency_code;
  sale_exchange_rate numeric;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  normalized_phone := public.normalize_phone(p_phone);
  if normalized_phone is null then
    raise exception 'Telefono es obligatorio';
  end if;

  select id, dial_code
  into country_row
  from public.countries
  where id = coalesce(p_country_id, (select id from public.countries where iso2 = 'BO'))
    and status = 'active'
  limit 1;

  if country_row.id is null then
    raise exception 'Pais invalido';
  end if;

  customer_phone_e164 := public.to_e164(country_row.id, p_phone);

  if p_duration_months is null or p_duration_months < 1 then
    raise exception 'La duracion debe ser de al menos 1 mes';
  end if;

  select p.id, p.slug, p.service_id, p.name, p.purchase_mode, p.default_price_amount, p.default_price_currency, p.default_exchange_rate, sv.slug as service_slug
  into product_row
  from public.products p
  join public.services sv on sv.id = p.service_id
  where p.slug = p_product_slug and p.status = 'active'
  limit 1;

  if product_row.id is null then
    raise exception 'Producto invalido';
  end if;

  sale_price_amount := coalesce(p_price_amount, product_row.default_price_amount, 0);
  sale_price_currency := coalesce(p_price_currency, product_row.default_price_currency, 'BOB');
  sale_exchange_rate := coalesce(p_exchange_rate, product_row.default_exchange_rate);

  if sale_price_amount < 0 then
    raise exception 'El precio no puede ser negativo';
  end if;

  insert into public.customers(display_name, phone, phone_normalized, phone_e164, country_id)
  values (coalesce(nullif(trim(p_customer_name), ''), p_phone), p_phone, normalized_phone, customer_phone_e164, country_row.id)
  on conflict (phone_e164) where phone_e164 is not null
  do update set
    phone = excluded.phone,
    phone_normalized = excluded.phone_normalized,
    country_id = excluded.country_id,
    display_name = coalesce(nullif(trim(p_customer_name), ''), public.customers.display_name),
    updated_at = now()
  returning id into customer_id;

  account_id := p_service_account_id;

  if product_row.purchase_mode in ('individual', 'linked') and account_id is null then
    raise exception 'Este item requiere una cuenta enlazada';
  end if;

  if account_id is not null then
    select sa.id, sa.service_id, sv.slug as service_slug
    into selected_account
    from public.service_accounts sa
    join public.services sv on sv.id = sa.service_id
    where sa.id = account_id and sa.status = 'active';

    if selected_account.id is null then
      raise exception 'Cuenta base invalida';
    end if;

    if selected_account.service_id <> product_row.service_id then
      raise exception 'La cuenta elegida no pertenece a la plataforma del item';
    end if;

    if p_product_slug = 'spotify_family_member'
      and not exists (
        select 1
        from public.spotify_family_plans
        where service_account_id = account_id
      ) then
      raise exception 'La cuenta seleccionada no tiene datos de plan familiar';
    end if;
  end if;

  if sale_price_currency = 'BOB' then
    amount_bob := sale_price_amount;
    amount_usdt := case when sale_exchange_rate is not null and sale_exchange_rate > 0 then sale_price_amount / sale_exchange_rate else 0 end;
  else
    amount_usdt := sale_price_amount;
    amount_bob := case when sale_exchange_rate is not null and sale_exchange_rate > 0 then sale_price_amount * sale_exchange_rate else 0 end;
  end if;

  ends_on := p_starts_on + (p_duration_months * interval '1 month');

  insert into public.subscriptions(
    customer_id,
    product_id,
    service_account_id,
    slot_label,
    starts_on,
    ends_on,
    duration_months,
    current_price_amount,
    current_price_currency,
    current_exchange_rate,
    notes
  )
  values (
    customer_id,
    product_row.id,
    account_id,
    nullif(trim(p_profile_label), ''),
    p_starts_on,
    ends_on,
    p_duration_months,
    sale_price_amount,
    sale_price_currency,
    sale_exchange_rate,
    nullif(trim(p_notes), '')
  )
  returning id into subscription_id;

  insert into public.billing_cycles(
    subscription_id,
    period_start,
    period_end,
    due_on,
    status,
    expected_amount,
    expected_currency,
    exchange_rate,
    expected_bob,
    expected_usdt
  )
  values (
    subscription_id,
    p_starts_on,
    ends_on,
    p_starts_on,
    case when p_paid_now then 'paid'::public.billing_status else 'pending'::public.billing_status end,
    sale_price_amount,
    sale_price_currency,
    sale_exchange_rate,
    amount_bob,
    amount_usdt
  )
  returning id into cycle_id;

  if p_paid_now then
    insert into public.payments(
      customer_id,
      subscription_id,
      billing_cycle_id,
      payment_type,
      amount,
      currency,
      exchange_rate,
      amount_bob,
      amount_usdt,
      notes
    )
    values (
      customer_id,
      subscription_id,
      cycle_id,
      'new',
      sale_price_amount,
      sale_price_currency,
      sale_exchange_rate,
      amount_bob,
      amount_usdt,
      nullif(trim(p_notes), '')
    );
  end if;

  detail_fields := coalesce(p_visible_fields, '{}');
  if p_login_email is not null
    or p_login_password is not null
    or p_email_password is not null
    or p_invitation_email is not null
    or p_profile_label is not null
    or p_notes is not null
    or p_visible_to_customer then
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
      subscription_id,
      nullif(trim(p_login_email), ''),
      nullif(trim(p_login_password), ''),
      nullif(trim(p_email_password), ''),
      nullif(trim(p_invitation_email), ''),
      nullif(trim(p_profile_label), ''),
      nullif(trim(p_notes), ''),
      p_visible_to_customer,
      detail_fields
    );
  end if;

  return subscription_id;
end;
$$;

revoke all on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text, uuid
) from public, anon;

grant execute on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text, uuid
) to authenticated;
