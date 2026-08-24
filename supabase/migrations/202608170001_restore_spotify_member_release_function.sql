-- Restore the helper expected by the current Spotify assignment triggers.
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

revoke all on function public.release_spotify_members_for_subscription(uuid)
from public, anon, authenticated;
