create or replace function public.promote_spotify_member_to_mother(
  p_member_id uuid,
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
  member_row record;
  source_account record;
  sale_row record;
  access_row record;
  email_row record;
  new_account_id uuid;
  secret_payload text;
  today_date date := timezone('America/La_Paz', now())::date;
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

  select * into member_row
  from public.spotify_member_accounts
  where id = p_member_id
  for update;
  if not found or member_row.status = 'removed' then
    raise exception 'El miembro Spotify no está disponible';
  end if;

  select sa.*, sv.id as source_service_id, sv.slug as source_service_slug
  into source_account
  from public.service_accounts sa
  join public.services sv on sv.id = sa.service_id
  where sa.id = member_row.service_account_id
  for update;
  if not found or source_account.status <> 'active' or source_account.source_service_slug <> 'spotify' then
    raise exception 'La cuenta origen no es un plan Spotify activo';
  end if;

  select s.id, s.status, s.service_account_id, s.slot_label, p.slug as product_slug
  into sale_row
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.id = member_row.current_subscription_id
  for update of s;
  if found then
    if sale_row.status <> 'active' or sale_row.product_slug <> 'spotify_family_member'
       or sale_row.service_account_id <> member_row.service_account_id
       or sale_row.slot_label = 'Titular' then
      raise exception 'La venta activa del miembro no es válida para convertirla';
    end if;
    select d.* into access_row
    from public.subscription_access_details d
    where d.subscription_id = sale_row.id
    for update;
  end if;

  select id, email, email_password
  into email_row
  from public.email_addresses
  where lower(btrim(email)) = lower(btrim(member_row.login_email))
    and origin = 'self'
    and status = 'active'
  order by created_at desc
  limit 1
  for update;

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

  if email_row.id is not null then
    insert into public.email_usages(email_address_id, service_account_id, purpose)
    values (email_row.id, new_account_id, 'Spotify');
  end if;

  if sale_row.id is not null then
    update public.subscription_access_details
    set login_email = btrim(member_row.login_email),
        login_password = member_row.login_password,
        email_password = member_row.email_password,
        profile_label = 'Titular'
    where subscription_id = sale_row.id;

    update public.subscriptions
    set service_account_id = new_account_id,
        slot_label = 'Titular'
    where id = sale_row.id;

    update public.spotify_member_accounts
    set current_subscription_id = null,
        status = 'removed',
        removed_at = now(),
        updated_at = now()
    where id = member_row.id;
  else
    update public.spotify_member_accounts
    set status = 'removed', removed_at = now(), updated_at = now()
    where id = member_row.id;
  end if;

  return new_account_id;
end;
$$;

create or replace function public.demote_spotify_mother_to_members(
  p_account_id uuid,
  p_assignments jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  source_account record;
  sale_row record;
  access_row record;
  member_row record;
  target_account record;
  target_plan record;
  destination_member record;
  assignment jsonb;
  target_id uuid;
  member_id uuid;
  destination_member_id uuid;
  active_count integer;
  occupied_seats integer;
  processed_count integer := 0;
  today_date date := timezone('America/La_Paz', now())::date;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Las asignaciones no son válidas';
  end if;

  select sa.*, sv.slug as service_slug
  into source_account
  from public.service_accounts sa
  join public.services sv on sv.id = sa.service_id
  where sa.id = p_account_id
  for update;
  if not found or source_account.status <> 'active' or source_account.service_slug <> 'spotify' then
    raise exception 'La cuenta madre no es un plan Spotify activo';
  end if;

  select count(*) into active_count
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.service_account_id = p_account_id
    and s.status = 'active'
    and p.slug = 'spotify_family_member';

  if jsonb_array_length(coalesce(p_assignments, '[]'::jsonb)) <> active_count then
    raise exception 'Debes resolver cada cliente activo de la cuenta madre';
  end if;
  if exists (
    select 1
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    where s.service_account_id = p_account_id and s.status = 'active' and p.slug = 'spotify_family_member'
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) item
        where item->>'subscription_id' = s.id::text
      )
  ) then
    raise exception 'Falta una asignación de cliente';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) item
    where not exists (
      select 1 from public.subscriptions s
      join public.products p on p.id = s.product_id
      where s.id = (item->>'subscription_id')::uuid
        and s.service_account_id = p_account_id and s.status = 'active'
        and p.slug = 'spotify_family_member'
    )
  ) then
    raise exception 'Hay asignaciones que ya no pertenecen a esta cuenta';
  end if;

  perform 1
  from public.service_accounts sa
  where sa.id = p_account_id
     or sa.id in (
       select nullif(item->>'target_service_account_id', '')::uuid
       from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) item
       where nullif(item->>'target_service_account_id', '') is not null
     )
  order by sa.id
  for update;

  for sale_row in
    select s.*, p.slug as product_slug
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    where s.service_account_id = p_account_id
      and s.status = 'active'
      and p.slug = 'spotify_family_member'
    order by s.id
    for update of s
  loop
    select item into assignment
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) item
    where item->>'subscription_id' = sale_row.id::text;
    target_id := nullif(assignment->>'target_service_account_id', '')::uuid;

    select d.* into access_row
    from public.subscription_access_details d
    where d.subscription_id = sale_row.id
    for update;
    if not found or nullif(btrim(access_row.login_email), '') is null then
      raise exception 'La venta % no tiene credenciales Spotify válidas', sale_row.id;
    end if;

    select * into member_row
    from public.spotify_member_accounts
    where id = sale_row.spotify_member_account_id
    for update;

    if target_id is null then
      update public.subscriptions
      set service_account_id = null,
          slot_label = 'Miembro familiar',
          spotify_member_account_id = null
      where id = sale_row.id;

      if member_row.id is null then
        insert into public.spotify_member_accounts(
          service_account_id, source_subscription_id, current_subscription_id,
          login_email, login_password, email_password, member_name, status
        ) values (
          p_account_id, sale_row.id, null, btrim(access_row.login_email),
          access_row.login_password, access_row.email_password, null, 'available'
        );
      else
        update public.spotify_member_accounts
        set source_subscription_id = sale_row.id,
            current_subscription_id = null,
            login_email = btrim(access_row.login_email),
            login_password = access_row.login_password,
            email_password = access_row.email_password,
            status = 'available',
            removed_at = null,
            updated_at = now()
        where id = member_row.id;
      end if;
    elsif sale_row.slot_label <> 'Titular' then
      if sale_row.spotify_member_account_id is null then
        raise exception 'La venta % no tiene miembro Spotify asociado', sale_row.id;
      end if;
      perform public.move_spotify_member(sale_row.spotify_member_account_id, sale_row.id, target_id, p_account_id);
    else
      if target_id = p_account_id then raise exception 'El plan destino debe ser diferente al actual'; end if;
      select sa.*, sv.slug as service_slug
      into target_account
      from public.service_accounts sa
      join public.services sv on sv.id = sa.service_id
      where sa.id = target_id;
      if not found or target_account.status <> 'active' or target_account.service_slug <> 'spotify'
         or target_account.service_id <> source_account.service_id then
        raise exception 'El plan destino no es un plan Spotify compatible';
      end if;
      if target_account.renewal_due_on is not null and target_account.renewal_due_on <= today_date then
        raise exception 'El plan destino tiene la renovación vencida';
      end if;
      select * into target_plan from public.spotify_family_plans where service_account_id = target_id for update;
      if not found then raise exception 'El plan destino no tiene cupos configurados'; end if;
      select count(*) into occupied_seats
      from public.subscriptions s
      join public.products p on p.id = s.product_id
      where s.service_account_id = target_id and s.status = 'active' and p.slug = 'spotify_family_member';
      if occupied_seats >= target_plan.seats_total then
        raise exception 'El plan destino ya tiene sus % cupos ocupados', target_plan.seats_total;
      end if;

      update public.subscriptions
      set service_account_id = target_id,
          slot_label = 'Miembro familiar',
          spotify_member_account_id = null
      where id = sale_row.id;

      select * into destination_member
      from public.spotify_member_accounts
      where service_account_id = target_id
        and lower(btrim(login_email)) = lower(btrim(access_row.login_email))
      for update;
      if found and destination_member.status = 'removed' then
        raise exception 'La cuenta Spotify destino fue eliminada y no puede reasignarse';
      end if;
      if found and destination_member.current_subscription_id is not null then
        raise exception 'La cuenta Spotify ya está asignada a otro cliente';
      end if;
      if found then
        update public.spotify_member_accounts
        set source_subscription_id = null,
            current_subscription_id = sale_row.id,
            login_password = access_row.login_password,
            email_password = access_row.email_password,
            status = 'assigned', removed_at = null, updated_at = now()
        where id = destination_member.id
        returning id into destination_member_id;
      else
        insert into public.spotify_member_accounts(
          service_account_id, current_subscription_id, login_email,
          login_password, email_password, status
        ) values (
          target_id, sale_row.id, btrim(access_row.login_email),
          access_row.login_password, access_row.email_password, 'assigned'
        ) returning id into destination_member_id;
      end if;
      update public.subscriptions set spotify_member_account_id = destination_member_id where id = sale_row.id;
    end if;
    processed_count := processed_count + 1;
  end loop;

  update public.service_accounts
  set status = 'inactive', updated_at = now()
  where id = p_account_id;
  return processed_count;
end;
$$;

create or replace function public.assign_pending_spotify_member(
  p_member_id uuid,
  p_subscription_id uuid,
  p_target_service_account_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  member_row record;
  sale_row record;
  target_account record;
  target_plan record;
  access_row record;
  destination_member record;
  destination_member_id uuid;
  occupied_seats integer;
  today_date date := timezone('America/La_Paz', now())::date;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  select * into member_row from public.spotify_member_accounts where id = p_member_id for update;
  if not found or member_row.status <> 'available' or member_row.source_subscription_id <> p_subscription_id then
    raise exception 'El pendiente Spotify ya no está disponible';
  end if;
  select s.*, p.slug as product_slug
  into sale_row
  from public.subscriptions s join public.products p on p.id = s.product_id
  where s.id = p_subscription_id
  for update of s;
  if not found or sale_row.status <> 'active' or sale_row.service_account_id is not null
     or sale_row.product_slug <> 'spotify_family_member' then
    raise exception 'La venta pendiente ya no es válida';
  end if;
  if p_target_service_account_id = member_row.service_account_id then
    raise exception 'El plan destino debe ser diferente al plan archivado';
  end if;
  perform 1 from public.service_accounts where id in (member_row.service_account_id, p_target_service_account_id) order by id for update;
  select sa.*, sv.slug as service_slug into target_account
  from public.service_accounts sa join public.services sv on sv.id = sa.service_id
  where sa.id = p_target_service_account_id;
  if not found or target_account.status <> 'active' or target_account.service_slug <> 'spotify' then
    raise exception 'El plan destino no es un plan Spotify activo';
  end if;
  if target_account.renewal_due_on is not null and target_account.renewal_due_on <= today_date then
    raise exception 'El plan destino tiene la renovación vencida';
  end if;
  select * into target_plan from public.spotify_family_plans where service_account_id = p_target_service_account_id for update;
  if not found then raise exception 'El plan destino no tiene cupos configurados'; end if;
  select count(*) into occupied_seats
  from public.subscriptions s join public.products p on p.id = s.product_id
  where s.service_account_id = p_target_service_account_id and s.status = 'active' and p.slug = 'spotify_family_member';
  if occupied_seats >= target_plan.seats_total then
    raise exception 'El plan destino ya tiene sus % cupos ocupados', target_plan.seats_total;
  end if;
  select d.* into access_row from public.subscription_access_details d where d.subscription_id = p_subscription_id for update;
  if not found or nullif(btrim(access_row.login_email), '') is null then
    raise exception 'La venta pendiente no tiene credenciales válidas';
  end if;

  update public.subscriptions
  set service_account_id = p_target_service_account_id,
      slot_label = 'Miembro familiar',
      spotify_member_account_id = null
  where id = p_subscription_id;

  select * into destination_member
  from public.spotify_member_accounts
  where service_account_id = p_target_service_account_id
    and lower(btrim(login_email)) = lower(btrim(access_row.login_email))
  for update;
  if found and destination_member.status = 'removed' then
    raise exception 'La cuenta Spotify destino fue eliminada y no puede reasignarse';
  end if;
  if found and destination_member.current_subscription_id is not null then
    raise exception 'La cuenta Spotify ya está asignada a otro cliente';
  end if;
  if found then
    update public.spotify_member_accounts
    set source_subscription_id = null, current_subscription_id = p_subscription_id,
        login_password = access_row.login_password, email_password = access_row.email_password,
        member_name = coalesce(member_row.member_name, destination_member.member_name),
        status = 'assigned', removed_at = null, updated_at = now()
    where id = destination_member.id
    returning id into destination_member_id;
  else
    insert into public.spotify_member_accounts(
      service_account_id, current_subscription_id, login_email,
      login_password, email_password, member_name, status
    ) values (
      p_target_service_account_id, p_subscription_id, btrim(access_row.login_email),
      access_row.login_password, access_row.email_password, member_row.member_name, 'assigned'
    ) returning id into destination_member_id;
  end if;
  update public.subscriptions set spotify_member_account_id = destination_member_id where id = p_subscription_id;
  update public.spotify_member_accounts
  set current_subscription_id = null, status = 'removed', removed_at = now(), updated_at = now()
  where id = p_member_id;
  return destination_member_id;
end;
$$;

revoke all on function public.promote_spotify_member_to_mother(uuid, text, uuid, numeric, public.currency_code, numeric, numeric, numeric, date, integer, text, text) from public, anon;
grant execute on function public.promote_spotify_member_to_mother(uuid, text, uuid, numeric, public.currency_code, numeric, numeric, numeric, date, integer, text, text) to authenticated;
revoke all on function public.demote_spotify_mother_to_members(uuid, jsonb) from public, anon;
grant execute on function public.demote_spotify_mother_to_members(uuid, jsonb) to authenticated;
revoke all on function public.assign_pending_spotify_member(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_pending_spotify_member(uuid, uuid, uuid) to authenticated;
