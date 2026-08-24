create or replace function public.release_spotify_members_for_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  update public.spotify_member_accounts
  set current_subscription_id = null,
      source_subscription_id = p_subscription_id,
      status = case when status = 'removed' then 'removed' else 'available' end,
      updated_at = now()
  where current_subscription_id = p_subscription_id;

  update public.subscriptions
  set spotify_member_account_id = null
  where id = p_subscription_id;
end;
$$;

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

  -- A subscription can only have one current member. Release the previous
  -- plan/email assignment before resolving the destination member.
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
      login_email, login_password, email_password, invitation_email, status
    ) values (
      sale.service_account_id,
      case when sale.status = 'active' then null else sale.id end,
      case when sale.status = 'active' then sale.id else null end,
      btrim(new.login_email), new.login_password, new.email_password,
      new.invitation_email,
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
        invitation_email = new.invitation_email,
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

create or replace function public.sync_spotify_member_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  member record;
  product_slug text;
begin
  select p.slug into product_slug
  from public.products p
  where p.id = new.product_id;

  if product_slug <> 'spotify_family_member'
     or new.service_account_id is null
     or new.slot_label = 'Titular'
     or new.status <> 'active'
     or (tg_op = 'UPDATE' and (
       old.service_account_id is distinct from new.service_account_id
       or old.product_id is distinct from new.product_id
       or old.slot_label is distinct from new.slot_label
     )) then
    perform public.release_spotify_members_for_subscription(new.id);
    return new;
  end if;

  if new.spotify_member_account_id is not null then
    select * into member
    from public.spotify_member_accounts
    where id = new.spotify_member_account_id
    for update;
    if not found then
      return new;
    end if;
    if member.status = 'removed' then
      raise exception 'El miembro Spotify fue eliminado y no puede reactivarse';
    end if;
    if member.current_subscription_id is not null
       and member.current_subscription_id <> new.id then
      raise exception 'El miembro Spotify ya fue reasignado a otro cliente';
    end if;
    update public.spotify_member_accounts
    set current_subscription_id = new.id,
        status = 'assigned',
        updated_at = now()
    where id = new.spotify_member_account_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_spotify_member_status on public.subscriptions;
create trigger sync_spotify_member_status
after update of service_account_id, product_id, slot_label, status on public.subscriptions
for each row execute function public.sync_spotify_member_status();

revoke all on function public.release_spotify_members_for_subscription(uuid) from public, anon, authenticated;
revoke all on function public.sync_spotify_member_account() from public, anon, authenticated;
revoke all on function public.sync_spotify_member_status() from public, anon, authenticated;
