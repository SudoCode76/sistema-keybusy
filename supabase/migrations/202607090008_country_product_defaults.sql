create table if not exists public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null unique check (char_length(iso2) = 2),
  name text not null,
  dial_code text not null check (dial_code ~ '^[0-9]+$'),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

alter table public.countries enable row level security;

drop policy if exists "countries_admin_all" on public.countries;
drop policy if exists "countries_authenticated_read" on public.countries;
create policy "countries_admin_all" on public.countries for all using (private.is_admin()) with check (private.is_admin());
create policy "countries_authenticated_read" on public.countries for select using ((select auth.uid()) is not null);

insert into public.countries (iso2, name, dial_code) values
  ('BO', 'Bolivia', '591'),
  ('AR', 'Argentina', '54'),
  ('BR', 'Brasil', '55'),
  ('CL', 'Chile', '56'),
  ('CO', 'Colombia', '57'),
  ('CR', 'Costa Rica', '506'),
  ('CU', 'Cuba', '53'),
  ('DO', 'República Dominicana', '1'),
  ('EC', 'Ecuador', '593'),
  ('SV', 'El Salvador', '503'),
  ('GT', 'Guatemala', '502'),
  ('HN', 'Honduras', '504'),
  ('MX', 'México', '52'),
  ('NI', 'Nicaragua', '505'),
  ('PA', 'Panamá', '507'),
  ('PY', 'Paraguay', '595'),
  ('PE', 'Perú', '51'),
  ('PR', 'Puerto Rico', '1'),
  ('UY', 'Uruguay', '598'),
  ('VE', 'Venezuela', '58'),
  ('US', 'Estados Unidos', '1'),
  ('CA', 'Canadá', '1'),
  ('ES', 'España', '34'),
  ('PT', 'Portugal', '351'),
  ('FR', 'Francia', '33'),
  ('DE', 'Alemania', '49'),
  ('IT', 'Italia', '39'),
  ('GB', 'Reino Unido', '44'),
  ('NL', 'Países Bajos', '31'),
  ('BE', 'Bélgica', '32'),
  ('CH', 'Suiza', '41'),
  ('SE', 'Suecia', '46'),
  ('NO', 'Noruega', '47'),
  ('DK', 'Dinamarca', '45'),
  ('FI', 'Finlandia', '358'),
  ('IE', 'Irlanda', '353'),
  ('PL', 'Polonia', '48'),
  ('RO', 'Rumania', '40'),
  ('TR', 'Turquía', '90'),
  ('RU', 'Rusia', '7'),
  ('UA', 'Ucrania', '380'),
  ('CN', 'China', '86'),
  ('JP', 'Japón', '81'),
  ('KR', 'Corea del Sur', '82'),
  ('IN', 'India', '91'),
  ('ID', 'Indonesia', '62'),
  ('PH', 'Filipinas', '63'),
  ('TH', 'Tailandia', '66'),
  ('VN', 'Vietnam', '84'),
  ('MY', 'Malasia', '60'),
  ('SG', 'Singapur', '65'),
  ('AU', 'Australia', '61'),
  ('NZ', 'Nueva Zelanda', '64'),
  ('ZA', 'Sudáfrica', '27'),
  ('EG', 'Egipto', '20'),
  ('MA', 'Marruecos', '212'),
  ('NG', 'Nigeria', '234'),
  ('KE', 'Kenia', '254'),
  ('AE', 'Emiratos Árabes Unidos', '971'),
  ('SA', 'Arabia Saudita', '966'),
  ('IL', 'Israel', '972')
on conflict (iso2) do update set
  name = excluded.name,
  dial_code = excluded.dial_code;

alter table public.customers
add column if not exists country_id uuid references public.countries(id) on delete set null,
add column if not exists phone_e164 text;

alter table public.providers
add column if not exists country_id uuid references public.countries(id) on delete set null,
add column if not exists phone text,
add column if not exists phone_e164 text;

alter table public.products
add column if not exists default_price_amount numeric(12, 2) not null default 0 check (default_price_amount >= 0),
add column if not exists default_price_currency public.currency_code not null default 'BOB',
add column if not exists default_exchange_rate numeric(12, 6) check (default_exchange_rate is null or default_exchange_rate > 0);

create index if not exists customers_country_id_idx on public.customers(country_id);
create index if not exists providers_country_id_idx on public.providers(country_id);
create unique index if not exists customers_phone_e164_unique
on public.customers(phone_e164)
where phone_e164 is not null;

create or replace function public.to_e164(country_id uuid, phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.normalize_phone(phone) is null then null
    else '+' || c.dial_code || public.normalize_phone(phone)
  end
  from public.countries c
  where c.id = country_id
  limit 1;
$$;

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
as $$
begin
  new.phone_normalized := public.normalize_phone(new.phone);
  if new.country_id is not null then
    new.phone_e164 := public.to_e164(new.country_id, new.phone);
  end if;
  return new;
end;
$$;

create or replace function public.set_provider_phone_e164()
returns trigger
language plpgsql
as $$
begin
  if new.country_id is not null then
    new.phone_e164 := public.to_e164(new.country_id, new.phone);
  end if;
  return new;
end;
$$;

drop trigger if exists set_providers_phone_e164 on public.providers;
create trigger set_providers_phone_e164
before insert or update of country_id, phone on public.providers
for each row
execute function public.set_provider_phone_e164();

update public.customers c
set country_id = coalesce(c.country_id, bo.id),
    phone_e164 = coalesce(c.phone_e164, public.to_e164(bo.id, c.phone))
from public.countries bo
where bo.iso2 = 'BO'
  and c.phone is not null;

create or replace function public.whatsapp_url(phone_e164 text)
returns text
language sql
immutable
as $$
  select case
    when phone_e164 is null then null
    else 'https://wa.me/' || regexp_replace(phone_e164, '[^0-9]', '', 'g')
  end;
$$;

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

  select p.id, p.slug, p.service_id, p.name, p.default_price_amount, p.default_price_currency, p.default_exchange_rate, sv.slug as service_slug
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

  if p_product_slug in ('chatgpt_shared', 'spotify_family_member', 'netflix_profile', 'chatgpt_codex') and account_id is null then
    raise exception 'Este producto requiere una cuenta o plan existente';
  end if;

  if account_id is not null then
    select sa.id, sv.slug as service_slug
    into selected_account
    from public.service_accounts sa
    join public.services sv on sv.id = sa.service_id
    where sa.id = account_id and sa.status = 'active';

    if selected_account.id is null then
      raise exception 'Cuenta base invalida';
    end if;
  end if;

  if p_product_slug = 'chatgpt_shared' then
    if selected_account.service_slug <> 'chatgpt-shared' then
      raise exception 'Selecciona una cuenta ChatGPT compartida';
    end if;
  end if;

  if p_product_slug = 'spotify_family_member' then
    if selected_account.service_slug <> 'spotify' then
      raise exception 'Selecciona un plan familiar Spotify';
    end if;
    if not exists (select 1 from public.spotify_family_plans where service_account_id = account_id) then
      raise exception 'La cuenta seleccionada no tiene datos de plan familiar';
    end if;
  end if;

  if p_product_slug = 'netflix_profile' then
    if selected_account.service_slug <> 'netflix' then
      raise exception 'Selecciona una cuenta Netflix';
    end if;
  end if;

  if p_product_slug = 'chatgpt_codex' then
    if selected_account.service_slug <> 'chatgpt-private' then
      raise exception 'Selecciona una cuenta ChatGPT privada';
    end if;
  end if;

  if p_product_slug = 'chatgpt_private' and account_id is null then
    insert into public.service_accounts(
      service_id,
      provider_id,
      label,
      login_email,
      base_cost_amount,
      base_cost_currency,
      base_cost_bob,
      base_cost_usdt
    )
    values (
      product_row.service_id,
      p_provider_id,
      coalesce(nullif(trim(p_account_label), ''), nullif(trim(p_login_email), ''), 'ChatGPT privado ' || p_phone),
      nullif(trim(p_login_email), ''),
      0,
      'USDT',
      0,
      0
    )
    returning id into account_id;

    if nullif(trim(p_login_password), '') is not null then
      insert into public.account_credentials(service_account_id, secret_payload)
      values (account_id, 'password: ' || trim(p_login_password));
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

grant execute on function public.to_e164(uuid, text) to authenticated;
grant execute on function public.whatsapp_url(text) to authenticated;
grant execute on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date, integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text, uuid
) to authenticated;
