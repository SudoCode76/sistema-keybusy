alter table public.services
  add column if not exists account_model text not null default 'private'
    check (account_model in ('private', 'mother')),
  add column if not exists default_seat_capacity integer
    check (default_seat_capacity is null or default_seat_capacity > 0);

alter table public.service_accounts
  add column if not exists seat_capacity integer
    check (seat_capacity is null or seat_capacity > 0);

update public.services
set
  account_model = 'mother',
  default_seat_capacity = case slug
    when 'spotify' then 6
    when 'netflix' then 5
    when 'chatgpt-shared' then 10
  end
where slug in ('spotify', 'netflix', 'chatgpt-shared');

with active_uses as (
  select service_account_id, count(*)::integer as total
  from public.subscriptions
  where status = 'active' and service_account_id is not null
  group by service_account_id
), mother_accounts as (
  select
    account.id,
    greatest(
      coalesce(plan.seats_total, service.default_seat_capacity, 1),
      coalesce(active_uses.total, 0)
    ) as seat_capacity
  from public.service_accounts account
  join public.services service on service.id = account.service_id
  left join public.spotify_family_plans plan on plan.service_account_id = account.id
  left join active_uses on active_uses.service_account_id = account.id
  where service.account_model = 'mother'
    and account.seat_capacity is null
)
update public.service_accounts account
set seat_capacity = mother_accounts.seat_capacity
from mother_accounts
where account.id = mother_accounts.id;

create or replace function public.enforce_service_product_mode()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  model text;
begin
  select account_model into model from public.services where id = new.service_id;

  if model = 'mother' and new.purchase_mode <> 'inventory' then
    raise exception 'Los productos de una cuenta madre usan inventario compartido';
  end if;

  if model = 'private' and new.purchase_mode not in ('individual', 'linked') then
    raise exception 'Los productos de cuentas privadas deben usar una cuenta por cliente';
  end if;

  return new;
end;
$$;

drop trigger if exists products_enforce_service_model on public.products;
create trigger products_enforce_service_model
before insert or update of service_id, purchase_mode on public.products
for each row execute function public.enforce_service_product_mode();

create or replace function public.enforce_subscription_account_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  account_model text;
  purchase_mode text;
  capacity integer;
  used integer;
begin
  if new.service_account_id is null or new.status <> 'active' then
    return new;
  end if;

  select service.account_model, product.purchase_mode
  into account_model, purchase_mode
  from public.products product
  join public.services service on service.id = product.service_id
  where product.id = new.product_id;

  if account_model = 'mother' and purchase_mode = 'inventory' then
    select seat_capacity into capacity
    from public.service_accounts
    where id = new.service_account_id
    for update;

    if capacity is null then
      raise exception 'La cuenta madre no tiene cupos configurados';
    end if;

    select count(*) into used
    from public.subscriptions
    where service_account_id = new.service_account_id
      and status = 'active'
      and id is distinct from new.id;

    if used >= capacity then
      raise exception 'La cuenta madre ya no tiene cupos disponibles';
    end if;
  elsif account_model = 'private' and purchase_mode = 'individual' then
    if exists (
      select 1
      from public.subscriptions subscription
      join public.products product on product.id = subscription.product_id
      where subscription.service_account_id = new.service_account_id
        and subscription.status = 'active'
        and product.purchase_mode = 'individual'
        and subscription.id is distinct from new.id
    ) then
      raise exception 'Esta cuenta privada ya tiene un cliente activo';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_enforce_account_capacity on public.subscriptions;
create trigger subscriptions_enforce_account_capacity
before insert or update of service_account_id, product_id, status on public.subscriptions
for each row execute function public.enforce_subscription_account_capacity();

drop function if exists public.create_platform_with_product(
  text, text, text, text, text, text, text, text[], integer, numeric,
  public.currency_code, numeric, numeric, public.currency_code, numeric
);

create function public.create_platform_with_product(
  p_platform_name text,
  p_platform_slug text,
  p_description text,
  p_product_name text,
  p_product_slug text,
  p_product_type text,
  p_account_model text,
  p_default_seat_capacity integer,
  p_access_fields text[],
  p_duration_months integer,
  p_sale_amount numeric,
  p_sale_currency public.currency_code,
  p_sale_exchange_rate numeric,
  p_purchase_amount numeric,
  p_purchase_currency public.currency_code,
  p_purchase_exchange_rate numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  service_id uuid;
  product_id uuid;
  purchase_mode text := case when p_account_model = 'mother' then 'inventory' else 'individual' end;
  allowed_fields constant text[] := array[
    'login_email', 'login_password', 'email_password', 'profile_label',
    'invitation_email', 'two_factor_url'
  ];
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  if nullif(btrim(p_platform_name), '') is null or nullif(btrim(p_product_name), '') is null then
    raise exception 'Plataforma e item son obligatorios';
  end if;
  if p_account_model not in ('private', 'mother') then raise exception 'Modelo de cuenta invalido'; end if;
  if p_account_model = 'mother' and coalesce(p_default_seat_capacity, 0) < 1 then
    raise exception 'Define al menos un cupo para la cuenta madre';
  end if;
  if p_duration_months is null or p_duration_months < 1 then raise exception 'La duracion debe ser de al menos un mes'; end if;
  if not (coalesce(p_access_fields, '{}') <@ allowed_fields) then raise exception 'Campos de acceso invalidos'; end if;

  insert into public.services(name, slug, description, account_model, default_seat_capacity)
  values (
    btrim(p_platform_name), btrim(p_platform_slug), nullif(btrim(p_description), ''),
    p_account_model, case when p_account_model = 'mother' then p_default_seat_capacity else null end
  ) returning id into service_id;

  insert into public.products(
    service_id, slug, name, product_type, purchase_mode, access_fields,
    default_duration_months, default_price_amount, default_price_currency,
    default_exchange_rate, default_purchase_amount, default_purchase_currency,
    default_purchase_exchange_rate
  ) values (
    service_id, btrim(p_product_slug), btrim(p_product_name),
    coalesce(nullif(btrim(p_product_type), ''), 'profile'), purchase_mode,
    coalesce(p_access_fields, '{}'), p_duration_months, coalesce(p_sale_amount, 0),
    coalesce(p_sale_currency, 'BOB'), p_sale_exchange_rate,
    case when purchase_mode = 'individual' then coalesce(p_purchase_amount, 0) else 0 end,
    coalesce(p_purchase_currency, 'USDT'),
    case when purchase_mode = 'individual' then p_purchase_exchange_rate else null end
  ) returning id into product_id;

  return product_id;
end;
$$;

grant execute on function public.create_platform_with_product(
  text, text, text, text, text, text, text, integer, text[], integer,
  numeric, public.currency_code, numeric, numeric, public.currency_code, numeric
) to authenticated;
