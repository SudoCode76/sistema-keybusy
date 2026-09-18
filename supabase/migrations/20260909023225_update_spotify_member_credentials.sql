-- Update Spotify Member Credentials Transactionally
CREATE OR REPLACE FUNCTION public.update_spotify_member_credentials(
  p_member_id uuid,
  p_login_email text,
  p_login_password text DEFAULT NULL,
  p_email_password text DEFAULT NULL,
  p_member_name text DEFAULT NULL,
  p_profile_label text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
declare
  member_row record;
  sale_row record;
  access_row record;
  email_row record;
  old_email_usage record;
  new_member_id uuid;
  normalized_email text := lower(btrim(p_login_email));
  email_changed boolean;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  if normalized_email is null or normalized_email = '' then
    raise exception 'Correo de la cuenta es obligatorio';
  end if;

  select * into member_row
  from public.spotify_member_accounts
  where id = p_member_id
  for update;

  if not found then raise exception 'El miembro Spotify no existe'; end if;
  if member_row.status = 'removed' then
    raise exception 'El miembro Spotify fue eliminado y no puede editarse';
  end if;

  if member_row.current_subscription_id is null then
    update public.spotify_member_accounts
    set login_email = normalized_email,
        login_password = p_login_password,
        email_password = p_email_password,
        member_name = nullif(btrim(p_member_name), ''),
        updated_at = now()
    where id = p_member_id;
    return p_member_id;
  end if;

  select s.*, p.id as product_id, p.slug as product_slug
  into sale_row
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.id = member_row.current_subscription_id
  for update of s;

  if not found or sale_row.status <> 'active' or sale_row.product_slug <> 'spotify_family_member' then
    raise exception 'La venta activa del miembro no es válida';
  end if;

  if sale_row.service_account_id <> member_row.service_account_id then
    raise exception 'El miembro ya no pertenece al plan esperado';
  end if;

  select * into access_row
  from public.subscription_access_details
  where subscription_id = sale_row.id
  for update;

  if not found then
    raise exception 'No se encontraron los datos de acceso de la suscripción';
  end if;

  email_changed := lower(btrim(member_row.login_email)) is distinct from normalized_email;

  if email_changed then
    select * into email_row
    from public.email_addresses
    where email_normalized = normalized_email
      and origin = 'self'
      and status = 'active'
    for update;

    if not found then
      insert into public.email_addresses(email, email_password, origin)
      values (normalized_email, p_email_password, 'self')
      returning * into email_row;
    elsif p_email_password is not null then
      update public.email_addresses
      set email_password = p_email_password,
          updated_at = now()
      where id = email_row.id;
      email_row.email_password := p_email_password;
    end if;

    -- Do not allow the same Spotify login to serve two active customers in this plan.
    if exists (
      select 1
      from public.spotify_member_accounts m
      where m.service_account_id = sale_row.service_account_id
        and m.id <> p_member_id
        and lower(btrim(m.login_email)) = normalized_email
        and m.status <> 'removed'
        and m.current_subscription_id is not null
    ) then
      raise exception 'Este correo Spotify ya está asignado a otro cliente en este plan';
    end if;

    -- Close the old active email usage before creating the new one.
    select * into old_email_usage
    from public.email_usages
    where subscription_id = sale_row.id
      and ended_at is null
    order by started_at desc
    limit 1
    for update;

    if found then
      update public.email_usages
      set ended_at = now()
      where id = old_email_usage.id;
    end if;

    -- Release the prior member. It remains historical and never occupies a seat.
    update public.spotify_member_accounts
    set current_subscription_id = null,
        source_subscription_id = sale_row.id,
        status = 'removed',
        removed_at = now(),
        updated_at = now()
    where id = p_member_id;

    insert into public.spotify_member_accounts(
      service_account_id,
      current_subscription_id,
      login_email,
      login_password,
      email_password,
      member_name,
      status
    ) values (
      sale_row.service_account_id,
      sale_row.id,
      normalized_email,
      p_login_password,
      p_email_password,
      nullif(btrim(p_member_name), ''),
      'assigned'
    ) returning id into new_member_id;

    update public.subscriptions
    set spotify_member_account_id = new_member_id,
        updated_at = now()
    where id = sale_row.id;

    update public.subscription_access_details
    set login_email = normalized_email,
        login_password = p_login_password,
        email_password = p_email_password,
        profile_label = coalesce(nullif(btrim(p_profile_label), ''), 'Miembro familiar'),
        updated_at = now()
    where subscription_id = sale_row.id;

    insert into public.email_usages(
      email_address_id,
      subscription_id,
      purpose,
      platform_password
    ) values (
      email_row.id,
      sale_row.id,
      'Miembro Spotify familiar',
      p_login_password
    );

    return new_member_id;
  end if;

  -- Same email: update credentials in-place and preserve the current member/usage.
  update public.spotify_member_accounts
  set login_password = p_login_password,
      email_password = p_email_password,
      member_name = nullif(btrim(p_member_name), ''),
      updated_at = now()
  where id = p_member_id;

  update public.subscription_access_details
  set login_password = p_login_password,
      email_password = p_email_password,
      profile_label = coalesce(nullif(btrim(p_profile_label), ''), 'Miembro familiar'),
      updated_at = now()
  where subscription_id = sale_row.id;

  update public.email_usages
  set platform_password = coalesce(p_login_password, platform_password)
  where subscription_id = sale_row.id
    and ended_at is null;

  return p_member_id;
end;
$function$;

REVOKE ALL ON FUNCTION public.update_spotify_member_credentials(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_spotify_member_credentials(uuid, text, text, text, text, text) TO authenticated;
