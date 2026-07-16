alter table public.customers
add column if not exists telegram_username text;

create or replace function public.normalize_telegram_username(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(regexp_replace(btrim(coalesce(value, '')), '^@+', '')), '')
$$;

update public.customers
set telegram_username = public.normalize_telegram_username(telegram_username)
where telegram_username is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_telegram_username_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
    add constraint customers_telegram_username_check
    check (
      telegram_username is null
      or telegram_username ~ '^[a-z0-9_]{5,32}$'
    );
  end if;
end
$$;

create unique index if not exists customers_telegram_username_unique
on public.customers(telegram_username)
where telegram_username is not null;

create or replace function public.set_customer_telegram_username()
returns trigger
language plpgsql
as $$
begin
  new.telegram_username := public.normalize_telegram_username(new.telegram_username);
  return new;
end;
$$;

drop trigger if exists set_customers_telegram_username on public.customers;
create trigger set_customers_telegram_username
before insert or update of telegram_username on public.customers
for each row execute function public.set_customer_telegram_username();

drop function if exists public.create_sale_with_email(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text, uuid, boolean, uuid, text, uuid
);

drop function if exists public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text, uuid
);

drop function if exists public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text
);

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
  p_country_id uuid default null,
  p_telegram_username text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  normalized_phone text;
  normalized_telegram text;
  phone_customer_id uuid;
  telegram_customer_id uuid;
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
  customer_country_id uuid;
  sale_price_amount numeric;
  sale_price_currency public.currency_code;
  sale_exchange_rate numeric;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  normalized_phone := public.normalize_phone(nullif(btrim(p_phone), ''));
  normalized_telegram := public.normalize_telegram_username(p_telegram_username);

  if normalized_phone is null and normalized_telegram is null then
    raise exception 'Ingresa un telefono o un usuario de Telegram';
  end if;

  if normalized_telegram is not null
    and normalized_telegram !~ '^[a-z0-9_]{5,32}$' then
    raise exception 'Telegram debe tener entre 5 y 32 letras, numeros o guion bajo';
  end if;

  if normalized_phone is not null then
    select id, dial_code
    into country_row
    from public.countries
    where id = coalesce(p_country_id, (select id from public.countries where iso2 = 'BO'))
      and status = 'active'
    limit 1;

    if country_row.id is null then
      raise exception 'Pais invalido';
    end if;

    customer_country_id := country_row.id;
    customer_phone_e164 := public.to_e164(country_row.id, p_phone);
  end if;

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

  if customer_phone_e164 is not null then
    select id into phone_customer_id
    from public.customers
    where phone_e164 = customer_phone_e164
    limit 1;
  end if;

  if normalized_telegram is not null then
    select id into telegram_customer_id
    from public.customers
    where telegram_username = normalized_telegram
    limit 1;
  end if;

  if phone_customer_id is not null
    and telegram_customer_id is not null
    and phone_customer_id <> telegram_customer_id then
    raise exception 'El telefono y Telegram pertenecen a clientes diferentes';
  end if;

  customer_id := coalesce(phone_customer_id, telegram_customer_id);

  if customer_id is null then
    insert into public.customers(
      display_name,
      phone,
      phone_normalized,
      phone_e164,
      country_id,
      telegram_username
    )
    values (
      coalesce(
        nullif(trim(p_customer_name), ''),
        nullif(trim(p_phone), ''),
        '@' || normalized_telegram
      ),
      nullif(trim(p_phone), ''),
      normalized_phone,
      customer_phone_e164,
      customer_country_id,
      normalized_telegram
    )
    returning id into customer_id;
  else
    update public.customers
    set
      display_name = coalesce(
        nullif(trim(p_customer_name), ''),
        public.customers.display_name
      ),
      phone = case
        when normalized_phone is not null then nullif(trim(p_phone), '')
        else public.customers.phone
      end,
      phone_normalized = coalesce(normalized_phone, public.customers.phone_normalized),
      phone_e164 = coalesce(customer_phone_e164, public.customers.phone_e164),
      country_id = coalesce(customer_country_id, public.customers.country_id),
      telegram_username = coalesce(normalized_telegram, public.customers.telegram_username),
      updated_at = now()
    where id = customer_id;
  end if;

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

create or replace function public.create_sale_with_email(
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
  p_country_id uuid default null,
  p_manage_email boolean default false,
  p_email_address_id uuid default null,
  p_email_origin text default 'self',
  p_email_provider_id uuid default null,
  p_telegram_username text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  managed_email_id uuid;
  managed_email_value text;
  managed_email_password text;
  subscription_id uuid;
  linked_account_id uuid;
  product_name text;
  product_purchase_mode text;
  usage_password text;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  if p_manage_email then
    if p_email_address_id is not null then
      select id, email, email_password
      into managed_email_id, managed_email_value, managed_email_password
      from public.email_addresses
      where id = p_email_address_id and origin = 'self' and status = 'active';

      if managed_email_id is null then
        raise exception 'El correo seleccionado no esta disponible para reutilizar';
      end if;
    else
      if nullif(btrim(p_login_email), '') is null then
        raise exception 'Correo es obligatorio';
      end if;

      insert into public.email_addresses(email, email_password, origin, provider_id)
      values (
        btrim(p_login_email),
        nullif(p_email_password, ''),
        case when p_email_origin = 'provider' then 'provider' else 'self' end,
        case when p_email_origin = 'provider' then p_email_provider_id else null end
      )
      returning id, email, email_password
      into managed_email_id, managed_email_value, managed_email_password;
    end if;
  end if;

  subscription_id := public.create_sale(
    p_phone => p_phone,
    p_product_slug => p_product_slug,
    p_service_account_id => p_service_account_id,
    p_provider_id => p_provider_id,
    p_login_email => coalesce(managed_email_value, p_login_email),
    p_login_password => p_login_password,
    p_email_password => coalesce(managed_email_password, p_email_password),
    p_invitation_email => p_invitation_email,
    p_profile_label => p_profile_label,
    p_customer_name => p_customer_name,
    p_account_label => p_account_label,
    p_starts_on => p_starts_on,
    p_duration_months => p_duration_months,
    p_price_amount => p_price_amount,
    p_price_currency => p_price_currency,
    p_exchange_rate => p_exchange_rate,
    p_paid_now => p_paid_now,
    p_visible_to_customer => p_visible_to_customer,
    p_visible_fields => p_visible_fields,
    p_notes => p_notes,
    p_country_id => p_country_id,
    p_telegram_username => p_telegram_username
  );

  select s.service_account_id, p.name, p.purchase_mode
  into linked_account_id, product_name, product_purchase_mode
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.id = subscription_id;

  if managed_email_id is null and product_purchase_mode = 'individual' then
    select e.id, e.email, e.email_password
    into managed_email_id, managed_email_value, managed_email_password
    from public.service_accounts a
    join public.email_addresses e on e.id = a.email_address_id
    where a.id = linked_account_id and e.origin = 'self' and e.status = 'active';
  end if;

  if managed_email_id is not null then
    usage_password := p_login_password;
    if usage_password is null and linked_account_id is not null then
      select u.platform_password into usage_password
      from public.email_usages u
      where u.service_account_id = linked_account_id
      order by u.started_at desc
      limit 1;
    end if;

    insert into public.email_usages(
      email_address_id,
      service_account_id,
      subscription_id,
      purpose,
      platform_password
    ) values (
      managed_email_id,
      case when product_purchase_mode = 'individual' then linked_account_id else null end,
      subscription_id,
      product_name,
      usage_password
    );

    if product_purchase_mode = 'individual' and linked_account_id is not null then
      update public.service_accounts
      set email_address_id = managed_email_id
      where id = linked_account_id;
    end if;
  end if;

  return subscription_id;
end;
$$;

revoke all on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text, uuid, text
) from public, anon;

grant execute on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text, uuid, text
) to authenticated;

revoke all on function public.create_sale_with_email(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text, uuid, boolean, uuid, text, uuid, text
) from public, anon;

grant execute on function public.create_sale_with_email(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[],
  text, uuid, boolean, uuid, text, uuid, text
) to authenticated;
