create or replace function public.remove_orphaned_spotify_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  member_row record;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  select m.id, m.status, m.current_subscription_id, s.status as current_subscription_status
  into member_row
  from public.spotify_member_accounts m
  left join public.subscriptions s on s.id = m.current_subscription_id
  where m.id = p_member_id
  for update of m;

  if not found then
    raise exception 'Miembro Spotify no encontrado';
  end if;
  if member_row.status = 'removed' then
    return;
  end if;
  if member_row.status <> 'assigned' then
    raise exception 'Solo se pueden limpiar miembros Spotify asignados como huérfanos';
  end if;
  if member_row.current_subscription_status = 'active' then
    raise exception 'El miembro todavía tiene una venta activa y no puede eliminarse';
  end if;

  update public.spotify_member_accounts
  set status = 'removed',
      current_subscription_id = null,
      removed_at = coalesce(removed_at, now()),
      updated_at = now()
  where id = p_member_id;
end;
$$;

revoke all on function public.remove_orphaned_spotify_member(uuid) from public, anon;
grant execute on function public.remove_orphaned_spotify_member(uuid) to authenticated;
