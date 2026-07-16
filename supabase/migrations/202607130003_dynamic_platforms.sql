alter table public.products
  add column if not exists access_fields text[] not null default '{}';

alter table public.products
  drop constraint if exists products_access_fields_check;

alter table public.products
  add constraint products_access_fields_check check (
    access_fields <@ array[
      'login_email',
      'login_password',
      'email_password',
      'profile_label',
      'invitation_email',
      'two_factor_url'
    ]::text[]
  );

update public.products set access_fields = '{}'
where slug in ('chatgpt_shared', 'chatgpt_codex');

update public.products set access_fields = array['login_email', 'login_password', 'email_password']
where slug = 'spotify_family_member';

update public.products set access_fields = array['profile_label']
where slug = 'netflix_profile';

update public.products set access_fields = array['invitation_email']
where slug = 'canva_profile';

update public.products set access_fields = array['login_email', 'login_password', 'two_factor_url']
where slug = 'chatgpt_private';

update public.products set access_fields = array['login_email', 'login_password']
where slug in ('disney_profile', 'hbo_profile', 'hbo_max_profile');

create or replace function public.create_platform_with_product(
  p_platform_name text,
  p_platform_slug text,
  p_description text,
  p_product_name text,
  p_product_slug text,
  p_product_type text,
  p_purchase_mode text,
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
  allowed_fields constant text[] := array[
    'login_email',
    'login_password',
    'email_password',
    'profile_label',
    'invitation_email',
    'two_factor_url'
  ];
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  if nullif(btrim(p_platform_name), '') is null or nullif(btrim(p_product_name), '') is null then
    raise exception 'Plataforma e item son obligatorios';
  end if;

  if p_purchase_mode not in ('inventory', 'individual') then
    raise exception 'Modelo de compra invalido';
  end if;

  if p_duration_months is null or p_duration_months < 1 then
    raise exception 'La duracion debe ser de al menos un mes';
  end if;

  if not (coalesce(p_access_fields, '{}') <@ allowed_fields) then
    raise exception 'Campos de acceso invalidos';
  end if;

  insert into public.services(name, slug, description)
  values (btrim(p_platform_name), btrim(p_platform_slug), nullif(btrim(p_description), ''))
  returning id into service_id;

  insert into public.products(
    service_id,
    slug,
    name,
    product_type,
    purchase_mode,
    access_fields,
    default_duration_months,
    default_price_amount,
    default_price_currency,
    default_exchange_rate,
    default_purchase_amount,
    default_purchase_currency,
    default_purchase_exchange_rate
  ) values (
    service_id,
    btrim(p_product_slug),
    btrim(p_product_name),
    coalesce(nullif(btrim(p_product_type), ''), 'profile'),
    p_purchase_mode,
    coalesce(p_access_fields, '{}'),
    p_duration_months,
    coalesce(p_sale_amount, 0),
    coalesce(p_sale_currency, 'BOB'),
    p_sale_exchange_rate,
    case when p_purchase_mode = 'individual' then coalesce(p_purchase_amount, 0) else 0 end,
    coalesce(p_purchase_currency, 'USDT'),
    case when p_purchase_mode = 'individual' then p_purchase_exchange_rate else null end
  )
  returning id into product_id;

  return product_id;
end;
$$;

grant execute on function public.create_platform_with_product(
  text, text, text, text, text, text, text, text[], integer, numeric,
  public.currency_code, numeric, numeric, public.currency_code, numeric
) to authenticated;
