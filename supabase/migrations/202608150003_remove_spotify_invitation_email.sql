-- Spotify members no longer use a separate invitation email.
-- Keep subscription_access_details.invitation_email for products that support it.

update public.subscription_access_details d
set invitation_email = null
from public.subscriptions s
join public.products p on p.id = s.product_id
where d.subscription_id = s.id
  and p.slug = 'spotify_family_member'
  and d.invitation_email is not null;

create or replace function public.sync_spotify_member_account()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sale record;
  member record;
  member_id uuid;
  capacity integer;
  used integer;
begin
  select s.id, s.service_account_id, s.status, s.slot_label, p.slug
  into sale
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.id = new.subscription_id;

  if sale.slug <> 'spotify_family_member'
     or sale.service_account_id is null
     or sale.slot_label = 'Titular' then
    perform public.release_spotify_members_for_subscription(sale.id);
    return new;
  end if;

  if nullif(btrim(new.login_email), '') is null then
    perform public.release_spotify_members_for_subscription(sale.id);
    return new;
  end if;

  perform public.release_spotify_members_for_subscription(sale.id);

  select sa.seat_capacity into capacity
  from public.service_accounts sa
  where sa.id = sale.service_account_id
  for update;

  select * into member
  from public.spotify_member_accounts
  where service_account_id = sale.service_account_id
    and lower(btrim(login_email)) = lower(btrim(new.login_email))
  for update;

  if member.id is null then
    if capacity is not null then
      select count(*) into used
      from public.spotify_member_accounts
      where service_account_id = sale.service_account_id and status <> 'removed';
      select used + count(*) into used
      from public.subscriptions owner_sale
      join public.products owner_product on owner_product.id = owner_sale.product_id
      where owner_sale.service_account_id = sale.service_account_id
        and owner_product.slug = 'spotify_family_member'
        and owner_sale.slot_label = 'Titular'
        and owner_sale.status = 'active';
      if used >= capacity then
        raise exception 'El plan familiar Spotify ya tiene sus % cupos ocupados', capacity;
      end if;
    end if;

    insert into public.spotify_member_accounts(
      service_account_id, source_subscription_id, current_subscription_id,
      login_email, login_password, email_password, status
    ) values (
      sale.service_account_id,
      case when sale.status = 'active' then null else sale.id end,
      case when sale.status = 'active' then sale.id else null end,
      btrim(new.login_email), new.login_password, new.email_password,
      case when sale.status = 'active' then 'assigned' else 'available' end
    ) returning id into member_id;
  else
    if member.status = 'removed' then
      raise exception 'Este miembro fue eliminado de Spotify y no puede reasignarse';
    end if;
    if sale.status = 'active'
       and member.current_subscription_id is not null
       and member.current_subscription_id <> sale.id then
      raise exception 'Esta cuenta Spotify ya fue asignada a otro cliente';
    end if;

    update public.spotify_member_accounts
    set login_password = new.login_password,
        email_password = new.email_password,
        current_subscription_id = case when sale.status = 'active' then sale.id else null end,
        source_subscription_id = case when sale.status = 'active' then source_subscription_id else sale.id end,
        status = case when sale.status = 'active' then 'assigned' else 'available' end,
        updated_at = now()
    where id = member.id
    returning id into member_id;
  end if;

  update public.subscriptions
  set spotify_member_account_id = member_id
  where id = sale.id and spotify_member_account_id is distinct from member_id;

  return new;
end;
$$;

drop trigger if exists sync_spotify_member_account on public.subscription_access_details;
create trigger sync_spotify_member_account
after insert or update of login_email, login_password, email_password
on public.subscription_access_details
for each row execute function public.sync_spotify_member_account();

create or replace function public.move_spotify_member(
  p_member_id uuid,
  p_subscription_id uuid,
  p_target_service_account_id uuid,
  p_expected_current_service_account_id uuid default null
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
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  select * into member_row
  from public.spotify_member_accounts
  where id = p_member_id
  for update;

  if not found then raise exception 'Miembro Spotify no encontrado'; end if;
  if member_row.status <> 'assigned' or member_row.current_subscription_id is null then
    raise exception 'El miembro Spotify ya no está asignado a una venta activa';
  end if;
  if member_row.current_subscription_id <> p_subscription_id then
    raise exception 'La asignación del miembro cambió; actualiza la página e inténtalo de nuevo';
  end if;

  select s.id, s.service_account_id, s.status, s.slot_label,
         p.slug as product_slug, p.service_id
  into sale_row
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.id = p_subscription_id
  for update of s;

  if not found then raise exception 'Venta Spotify no encontrada'; end if;
  if sale_row.status <> 'active' or sale_row.product_slug <> 'spotify_family_member' then
    raise exception 'La venta no es una suscripción Spotify activa';
  end if;
  if sale_row.slot_label = 'Titular' then
    raise exception 'El titular no puede cambiarse desde esta acción';
  end if;
  if member_row.service_account_id <> sale_row.service_account_id then
    raise exception 'El miembro y la venta ya no pertenecen al mismo plan';
  end if;
  if p_expected_current_service_account_id is not null
     and p_expected_current_service_account_id <> sale_row.service_account_id then
    raise exception 'El plan actual cambió; actualiza la página e inténtalo de nuevo';
  end if;
  if sale_row.service_account_id = p_target_service_account_id then
    raise exception 'El plan destino debe ser diferente al actual';
  end if;

  select d.login_email, d.login_password, d.email_password
  into access_row
  from public.subscription_access_details d
  where d.subscription_id = p_subscription_id
  for update;
  if not found or nullif(btrim(access_row.login_email), '') is null then
    raise exception 'La venta no tiene un correo Spotify válido';
  end if;

  perform 1
  from public.service_accounts sa
  where sa.id in (sale_row.service_account_id, p_target_service_account_id)
  order by sa.id
  for update;

  select sa.id, sa.status, sa.service_id, sa.renewal_due_on,
         sv.slug as service_slug
  into target_account
  from public.service_accounts sa
  join public.services sv on sv.id = sa.service_id
  where sa.id = p_target_service_account_id
  for update;

  if not found or target_account.status <> 'active'
     or target_account.service_id <> sale_row.service_id
     or target_account.service_slug <> 'spotify' then
    raise exception 'El plan destino no es un plan Spotify activo';
  end if;
  if target_account.renewal_due_on is not null
     and target_account.renewal_due_on <= today_date then
    raise exception 'El plan destino tiene la renovación vencida';
  end if;

  select sfp.service_account_id, sfp.seats_total
  into target_plan
  from public.spotify_family_plans sfp
  where sfp.service_account_id = p_target_service_account_id
  for update;
  if not found or target_plan.seats_total is null then
    raise exception 'El plan destino no tiene cupos configurados';
  end if;

  select count(*) into occupied_seats
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.service_account_id = p_target_service_account_id
    and p.slug = 'spotify_family_member'
    and s.status not in ('canceled', 'inactive')
    and s.id is distinct from p_subscription_id;

  if occupied_seats >= target_plan.seats_total then
    raise exception 'El plan destino ya tiene sus % cupos ocupados', target_plan.seats_total;
  end if;

  update public.subscriptions
  set service_account_id = p_target_service_account_id,
      updated_at = now()
  where id = p_subscription_id;

  update public.spotify_member_accounts
  set current_subscription_id = null,
      source_subscription_id = p_subscription_id,
      status = 'removed',
      removed_at = coalesce(removed_at, now()),
      updated_at = now()
  where current_subscription_id = p_subscription_id;

  select * into destination_member
  from public.spotify_member_accounts
  where service_account_id = p_target_service_account_id
    and lower(btrim(login_email)) = lower(btrim(access_row.login_email))
  for update;

  if found then
    if destination_member.status = 'removed'
       and destination_member.source_subscription_id <> p_subscription_id then
      raise exception 'El miembro destino fue eliminado de Spotify y no puede reasignarse';
    end if;
    if destination_member.status <> 'removed'
       and destination_member.current_subscription_id is not null
       and destination_member.current_subscription_id <> p_subscription_id then
      raise exception 'La cuenta Spotify ya está asignada a otro cliente en el plan destino';
    end if;

    update public.spotify_member_accounts
    set login_password = access_row.login_password,
        email_password = access_row.email_password,
        member_name = coalesce(member_row.member_name, destination_member.member_name),
        source_subscription_id = null,
        current_subscription_id = p_subscription_id,
        status = 'assigned',
        removed_at = null,
        updated_at = now()
    where id = destination_member.id
    returning id into destination_member_id;
  else
    insert into public.spotify_member_accounts(
      service_account_id, source_subscription_id, current_subscription_id,
      login_email, login_password, email_password, member_name, status
    ) values (
      p_target_service_account_id, null, p_subscription_id,
      btrim(access_row.login_email), access_row.login_password,
      access_row.email_password, member_row.member_name, 'assigned'
    ) returning id into destination_member_id;
  end if;

  update public.subscriptions
  set spotify_member_account_id = destination_member_id
  where id = p_subscription_id;

  return destination_member_id;
end;
$$;

revoke all on function public.move_spotify_member(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.move_spotify_member(uuid, uuid, uuid, uuid) to authenticated;

alter table public.spotify_member_accounts
  drop column if exists invitation_email;
