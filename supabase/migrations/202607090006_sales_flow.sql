create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(input, ''), '\D', '', 'g'), '');
$$;

alter table public.customers
add column if not exists phone_normalized text;

update public.customers
set phone_normalized = public.normalize_phone(phone)
where phone_normalized is null and phone is not null;

create unique index if not exists customers_phone_normalized_unique
on public.customers(phone_normalized)
where phone_normalized is not null;

create or replace function public.set_customer_phone_normalized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone_normalized := public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists set_customers_phone_normalized on public.customers;
create trigger set_customers_phone_normalized
before insert or update of phone on public.customers
for each row
execute function public.set_customer_phone_normalized();

update public.products set slug = 'spotify_family_member' where slug = 'spotify-family-member';
update public.products set slug = 'netflix_profile' where slug = 'netflix-profile';
update public.products set slug = 'chatgpt_shared' where slug = 'chatgpt-shared-seat';
update public.products set slug = 'chatgpt_private' where slug = 'chatgpt-private-main';
update public.products set slug = 'chatgpt_codex' where slug = 'chatgpt-private-codex';
update public.products set slug = 'canva_profile' where slug = 'canva-profile';
update public.products set slug = 'disney_profile' where slug = 'disney-profile';

create table if not exists public.subscription_access_details (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null unique references public.subscriptions(id) on delete cascade,
  login_email text,
  login_password text,
  email_password text,
  invitation_email text,
  profile_label text,
  notes text,
  visible_to_customer boolean not null default false,
  visible_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscription_access_details enable row level security;

drop policy if exists "subscription_access_details_admin_all" on public.subscription_access_details;
create policy "subscription_access_details_admin_all"
on public.subscription_access_details
for all
using (private.is_admin())
with check (private.is_admin());

drop trigger if exists set_subscription_access_details_updated_at on public.subscription_access_details;
create trigger set_subscription_access_details_updated_at
before update on public.subscription_access_details
for each row
execute function public.set_updated_at();

create index if not exists subscription_access_details_subscription_id_idx
on public.subscription_access_details(subscription_id);

drop view if exists public.customer_portal_orders_view;
create view public.customer_portal_orders_view as
select
  s.id as subscription_id,
  c.profile_id,
  c.display_name as customer_name,
  sv.name as service_name,
  p.name as product_name,
  s.slot_label,
  s.starts_on,
  s.ends_on,
  s.status,
  s.current_price_amount,
  s.current_price_currency,
  case when d.visible_to_customer and 'login_email' = any(d.visible_fields) then d.login_email end as login_email,
  case when d.visible_to_customer and 'login_password' = any(d.visible_fields) then d.login_password end as login_password,
  case when d.visible_to_customer and 'email_password' = any(d.visible_fields) then d.email_password end as email_password,
  case when d.visible_to_customer and 'invitation_email' = any(d.visible_fields) then d.invitation_email end as invitation_email,
  case when d.visible_to_customer and 'profile_label' = any(d.visible_fields) then d.profile_label end as profile_label,
  case when d.visible_to_customer and 'notes' = any(d.visible_fields) then d.notes end as access_notes
from public.subscriptions s
join public.customers c on c.id = s.customer_id
join public.products p on p.id = s.product_id
join public.services sv on sv.id = p.service_id
left join public.subscription_access_details d on d.subscription_id = s.id
where private.is_admin() or c.profile_id = auth.uid();

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
  p_price_amount numeric default 0,
  p_price_currency public.currency_code default 'BOB',
  p_exchange_rate numeric default null,
  p_paid_now boolean default false,
  p_visible_to_customer boolean default false,
  p_visible_fields text[] default '{}',
  p_notes text default null
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
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  normalized_phone := public.normalize_phone(p_phone);
  if normalized_phone is null then
    raise exception 'Telefono es obligatorio';
  end if;

  if p_duration_months is null or p_duration_months < 1 then
    raise exception 'La duracion debe ser de al menos 1 mes';
  end if;

  if p_price_amount is null or p_price_amount < 0 then
    raise exception 'El precio no puede ser negativo';
  end if;

  select p.id, p.slug, p.service_id, p.name, sv.slug as service_slug
  into product_row
  from public.products p
  join public.services sv on sv.id = p.service_id
  where p.slug = p_product_slug and p.status = 'active'
  limit 1;

  if product_row.id is null then
    raise exception 'Producto invalido';
  end if;

  insert into public.customers(display_name, phone, phone_normalized)
  values (coalesce(nullif(trim(p_customer_name), ''), p_phone), p_phone, normalized_phone)
  on conflict (phone_normalized) where phone_normalized is not null
  do update set
    phone = excluded.phone,
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

  if p_product_slug = 'chatgpt_shared' and selected_account.service_slug <> 'chatgpt-shared' then
    raise exception 'Selecciona una cuenta ChatGPT compartida';
  end if;

  if p_product_slug = 'spotify_family_member' then
    if selected_account.service_slug <> 'spotify' then
      raise exception 'Selecciona un plan familiar Spotify';
    end if;
    if not exists (select 1 from public.spotify_family_plans where service_account_id = account_id) then
      raise exception 'La cuenta seleccionada no tiene datos de plan familiar';
    end if;
  end if;

  if p_product_slug = 'netflix_profile' and selected_account.service_slug <> 'netflix' then
    raise exception 'Selecciona una cuenta Netflix';
  end if;

  if p_product_slug = 'chatgpt_codex' and selected_account.service_slug <> 'chatgpt-private' then
    raise exception 'Selecciona una cuenta ChatGPT privada';
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

  if p_price_currency = 'BOB' then
    amount_bob := p_price_amount;
    amount_usdt := case when p_exchange_rate is not null and p_exchange_rate > 0 then p_price_amount / p_exchange_rate else 0 end;
  else
    amount_usdt := p_price_amount;
    amount_bob := case when p_exchange_rate is not null and p_exchange_rate > 0 then p_price_amount * p_exchange_rate else 0 end;
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
    p_price_amount,
    p_price_currency,
    p_exchange_rate,
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
    p_price_amount,
    p_price_currency,
    p_exchange_rate,
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
      p_price_amount,
      p_price_currency,
      p_exchange_rate,
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

revoke execute on function public.normalize_phone(text) from public;
grant execute on function public.normalize_phone(text) to authenticated;

revoke execute on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date, integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text
) from public;
grant execute on function public.create_sale(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date, integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text
) to authenticated;
