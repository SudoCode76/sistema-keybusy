-- Rotate Spotify Mother Account (Reemplazar cuenta madre)
create or replace function public.rotate_spotify_mother_account(
  p_source_account_id uuid,
  p_new_mother_member_id uuid,
  p_label text,
  p_provider_id uuid default null,
  p_base_cost_amount numeric default 0,
  p_base_cost_currency public.currency_code default 'USDT',
  p_base_cost_exchange_rate numeric default null,
  p_base_cost_bob numeric default 0,
  p_base_cost_usdt numeric default 0,
  p_renewal_due_on date default null,
  p_seat_capacity integer default 6,
  p_invite_url text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  source_account record;
  member_row record;
  old_titular_sale record;
  email_row record;
  new_account_id uuid;
  secret_payload text;
  today_date date := timezone('America/La_Paz', now())::date;
  sale_row record;
  access_row record;
  destination_member_id uuid;
  active_members_count integer;
  processed_count integer := 0;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  if nullif(btrim(p_label), '') is null then raise exception 'La etiqueta es obligatoria'; end if;
  if p_seat_capacity is null or p_seat_capacity < 1 then raise exception 'Los cupos deben ser mayores a cero'; end if;
  if p_base_cost_amount is null or p_base_cost_amount < 0 then raise exception 'El costo no puede ser negativo'; end if;
  if p_base_cost_exchange_rate is not null and p_base_cost_exchange_rate <= 0 then
    raise exception 'El tipo de cambio debe ser mayor a cero';
  end if;
  if p_renewal_due_on is null or p_renewal_due_on < today_date then
    raise exception 'La renovación debe ser hoy o una fecha futura';
  end if;

  -- 1. Validar cuenta origen
  select sa.*, sv.id as source_service_id, sv.slug as source_service_slug
  into source_account
  from public.service_accounts sa
  join public.services sv on sv.id = sa.service_id
  where sa.id = p_source_account_id
  for update;
  if not found or source_account.status <> 'active' or source_account.source_service_slug <> 'spotify' then
    raise exception 'La cuenta origen no es un plan Spotify activo';
  end if;

  -- 2. Validar que la cuenta destino (miembro) existe y pertenece a esta cuenta
  select * into member_row
  from public.spotify_member_accounts
  where id = p_new_mother_member_id
  for update;
  if not found or member_row.status <> 'assigned' or member_row.service_account_id <> p_source_account_id then
    raise exception 'El miembro Spotify seleccionado no está asignado activamente a esta cuenta';
  end if;

  if member_row.current_subscription_id is null then
    raise exception 'El miembro seleccionado no tiene una venta activa';
  end if;

  -- 3. Validar capacidad
  select count(*) into active_members_count
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.service_account_id = p_source_account_id
    and s.status = 'active'
    and p.slug = 'spotify_family_member';

  if active_members_count > p_seat_capacity then
    raise exception 'La nueva capacidad (%) es menor que el número de ocupantes actuales (%)', p_seat_capacity, active_members_count;
  end if;

  -- 4. Registrar o actualizar correo del nuevo titular en email_addresses
  select id, email, email_password
  into email_row
  from public.email_addresses
  where lower(btrim(email)) = lower(btrim(member_row.login_email))
    and origin = 'self'
    and status = 'active'
  order by created_at desc
  limit 1
  for update;

  if email_row.id is null then
    insert into public.email_addresses(email, email_password, origin, provider_id)
    values (btrim(member_row.login_email), member_row.email_password, 'self', null)
    returning id, email, email_password into email_row;
  elsif email_row.email_password is null and member_row.email_password is not null then
    update public.email_addresses
    set email_password = member_row.email_password, updated_at = now()
    where id = email_row.id;
  end if;

  -- 5. Crear la nueva cuenta madre
  insert into public.service_accounts(
    service_id, provider_id, email_address_id, label, login_email,
    base_cost_amount, base_cost_currency, base_cost_exchange_rate,
    base_cost_bob, base_cost_usdt, status, renewal_due_on, seat_capacity
  ) values (
    source_account.service_id, p_provider_id, email_row.id, btrim(p_label), btrim(member_row.login_email),
    p_base_cost_amount, p_base_cost_currency, p_base_cost_exchange_rate,
    coalesce(p_base_cost_bob, 0), coalesce(p_base_cost_usdt, 0), 'active', p_renewal_due_on, p_seat_capacity
  ) returning id into new_account_id;

  secret_payload := concat_ws(E'\n',
    case when nullif(member_row.login_password, '') is not null then 'platform_password: ' || member_row.login_password end,
    case when nullif(member_row.email_password, '') is not null then 'email_password: ' || member_row.email_password end
  );
  if nullif(secret_payload, '') is not null then
    insert into public.account_credentials(service_account_id, secret_payload)
    values (new_account_id, secret_payload);
  end if;

  insert into public.spotify_family_plans(service_account_id, invite_url, address, seats_total)
  values (new_account_id, nullif(btrim(p_invite_url), ''), nullif(btrim(p_address), ''), p_seat_capacity);

  if p_base_cost_amount > 0 then
    insert into public.costs(
      service_account_id, provider_id, cost_type, amount, currency,
      exchange_rate, amount_bob, amount_usdt
    ) values (
      new_account_id, p_provider_id, 'purchase', p_base_cost_amount, p_base_cost_currency,
      p_base_cost_exchange_rate, coalesce(p_base_cost_bob, 0), coalesce(p_base_cost_usdt, 0)
    );
  end if;

  insert into public.email_usages(email_address_id, service_account_id, purpose, platform_password)
  values (email_row.id, new_account_id, 'Spotify', member_row.login_password);

  -- 6. Mover todos los miembros de la cuenta vieja a la nueva
  for sale_row in
    select s.*
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    where s.service_account_id = p_source_account_id
      and s.status = 'active'
      and p.slug = 'spotify_family_member'
    order by s.id
    for update of s
  loop
    select d.* into access_row
    from public.subscription_access_details d
    where d.subscription_id = sale_row.id
    for update;

    -- Si esta venta es la del nuevo titular
    if sale_row.id = member_row.current_subscription_id then
      update public.subscription_access_details
      set login_email = btrim(member_row.login_email),
          login_password = member_row.login_password,
          email_password = member_row.email_password,
          profile_label = 'Titular',
          updated_at = now()
      where subscription_id = sale_row.id;

      update public.subscriptions
      set service_account_id = new_account_id,
          slot_label = 'Titular',
          spotify_member_account_id = null,
          updated_at = now()
      where id = sale_row.id;

      update public.spotify_member_accounts
      set current_subscription_id = null,
          status = 'removed',
          removed_at = now(),
          updated_at = now()
      where id = member_row.id;

    -- Si esta venta es del titular anterior
    elsif sale_row.slot_label = 'Titular' then
      select * into old_titular_sale from public.service_accounts where id = p_source_account_id;

      insert into public.spotify_member_accounts(
        service_account_id, current_subscription_id, login_email,
        login_password, email_password, member_name, status
      ) values (
        new_account_id, sale_row.id, coalesce(access_row.login_email, old_titular_sale.login_email),
        access_row.login_password, access_row.email_password, access_row.profile_label, 'assigned'
      ) returning id into destination_member_id;

      update public.subscriptions
      set service_account_id = new_account_id,
          slot_label = 'Miembro familiar',
          spotify_member_account_id = destination_member_id,
          updated_at = now()
      where id = sale_row.id;

      update public.subscription_access_details
      set profile_label = 'Miembro familiar',
          updated_at = now()
      where subscription_id = sale_row.id;

      -- Cerrar uso de email viejo
      update public.email_usages
      set ended_at = now()
      where service_account_id = p_source_account_id and ended_at is null;

    -- Si es cualquier otro miembro regular
    else
      if sale_row.spotify_member_account_id is null then
        raise exception 'La venta % no tiene miembro Spotify asociado', sale_row.id;
      end if;
      perform public.move_spotify_member(sale_row.spotify_member_account_id, sale_row.id, new_account_id, p_source_account_id);
    end if;

    processed_count := processed_count + 1;
  end loop;

  -- 7. Archivar cuenta madre antigua y apuntar el reemplazo
  update public.service_accounts
  set status = 'replaced', 
      replacement_account_id = new_account_id,
      updated_at = now()
  where id = p_source_account_id;

  return new_account_id;
end;
$$;

revoke all on function public.rotate_spotify_mother_account(uuid, uuid, text, uuid, numeric, public.currency_code, numeric, numeric, numeric, date, integer, text, text) from public, anon;
grant execute on function public.rotate_spotify_mother_account(uuid, uuid, text, uuid, numeric, public.currency_code, numeric, numeric, numeric, date, integer, text, text) to authenticated;
