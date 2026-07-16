alter table public.email_addresses
  add column if not exists email_normalized text generated always as (lower(btrim(email))) stored,
  add column if not exists email_password text,
  add column if not exists origin text not null default 'self',
  add column if not exists provider_id uuid references public.providers(id) on delete set null;

alter table public.email_addresses
  drop constraint if exists email_addresses_origin_check;

alter table public.email_addresses
  add constraint email_addresses_origin_check check (origin in ('self', 'provider'));

do $$
begin
  if exists (
    select 1
    from public.email_addresses
    group by lower(btrim(email))
    having count(*) > 1
  ) then
    raise exception 'Existen correos duplicados; revisalos antes de aplicar la migracion';
  end if;
end;
$$;

create unique index if not exists email_addresses_normalized_unique
  on public.email_addresses(email_normalized);

create index if not exists email_addresses_provider_id_idx
  on public.email_addresses(provider_id);

alter table public.email_usages
  add column if not exists platform_password text;

create unique index if not exists email_usages_active_subscription_unique
  on public.email_usages(subscription_id)
  where subscription_id is not null and ended_at is null;

create unique index if not exists email_usages_active_inventory_unique
  on public.email_usages(service_account_id)
  where service_account_id is not null and subscription_id is null and ended_at is null;

create or replace view public.email_inventory_view
with (security_invoker = true)
as
select
  e.id,
  e.email,
  e.email_normalized,
  e.email_password,
  e.origin,
  e.provider_id,
  p.name as provider_name,
  e.status,
  e.notes,
  e.created_at,
  e.updated_at,
  count(u.id) filter (where u.ended_at is null)::integer as active_usage_count,
  max(u.started_at) as last_used_at
from public.email_addresses e
left join public.providers p on p.id = e.provider_id
left join public.email_usages u on u.email_address_id = e.id
group by e.id, p.name;

grant select on public.email_inventory_view to authenticated;

create or replace function public.sync_subscription_email_usage_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status in ('canceled', 'inactive') then
    update public.email_usages
    set ended_at = coalesce(ended_at, now())
    where subscription_id = new.id and ended_at is null;
  elsif old.status in ('canceled', 'inactive') and new.status not in ('canceled', 'inactive') then
    update public.email_usages
    set ended_at = null
    where id = (
      select id
      from public.email_usages
      where subscription_id = new.id
      order by started_at desc
      limit 1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_subscription_email_usage_status on public.subscriptions;
create trigger sync_subscription_email_usage_status
after update of status on public.subscriptions
for each row execute function public.sync_subscription_email_usage_status();

create or replace function public.sync_inventory_email_usage_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status <> 'active' then
    update public.email_usages
    set ended_at = coalesce(ended_at, now())
    where service_account_id = new.id
      and subscription_id is null
      and ended_at is null;
  elsif old.status <> 'active' and new.status = 'active' then
    update public.email_usages
    set ended_at = null
    where id = (
      select id
      from public.email_usages
      where service_account_id = new.id and subscription_id is null
      order by started_at desc
      limit 1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_inventory_email_usage_status on public.service_accounts;
create trigger sync_inventory_email_usage_status
after update of status on public.service_accounts
for each row execute function public.sync_inventory_email_usage_status();

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
  p_email_provider_id uuid default null
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
    p_country_id => p_country_id
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

grant execute on function public.create_sale_with_email(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text,
  uuid, boolean, uuid, text, uuid
) to authenticated;
