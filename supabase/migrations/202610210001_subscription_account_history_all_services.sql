alter table public.subscription_account_history
  add column if not exists is_estimated boolean not null default false;

-- The original private-account backfill used the account creation date as an estimate.
update public.subscription_account_history
set is_estimated = true
where created_at > assigned_at + interval '1 minute';

-- A released Spotify member still identifies the plan previously used by its sale.
insert into public.subscription_account_history (
  subscription_id, service_account_id, assigned_at, ended_at, is_estimated
)
select distinct on (s.id, m.service_account_id)
  s.id,
  m.service_account_id,
  s.created_at,
  greatest(s.created_at, coalesce(m.removed_at, m.updated_at)),
  true
from public.spotify_member_accounts m
join public.subscriptions s on s.id = m.source_subscription_id
where m.service_account_id is distinct from s.service_account_id
  and not exists (
    select 1 from public.subscription_account_history h
    where h.subscription_id = s.id and h.service_account_id = m.service_account_id
  )
order by s.id, m.service_account_id, m.removed_at desc nulls last;

-- Close old open rows when the current assignment changed before tracking existed.
update public.subscription_account_history h
set ended_at = greatest(h.assigned_at, s.updated_at), is_estimated = true
from public.subscriptions s
where h.subscription_id = s.id
  and h.ended_at is null
  and h.service_account_id is distinct from s.service_account_id;

-- Every sale with an account gets a starting point, including canceled sales.
insert into public.subscription_account_history (
  subscription_id, service_account_id, assigned_at, is_estimated
)
select s.id, s.service_account_id, s.created_at, true
from public.subscriptions s
where s.service_account_id is not null
  and not exists (
    select 1 from public.subscription_account_history h
    where h.subscription_id = s.id
      and h.service_account_id = s.service_account_id
      and h.ended_at is null
  );

create or replace function private.track_subscription_account_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.service_account_id is not distinct from new.service_account_id then
      return new;
    end if;

    update public.subscription_account_history
    set ended_at = greatest(assigned_at, now())
    where subscription_id = new.id and ended_at is null;
  end if;

  if new.service_account_id is not null then
    insert into public.subscription_account_history (
      subscription_id, service_account_id, assigned_at
    ) values (new.id, new.service_account_id, now());
  end if;

  return new;
end;
$$;

revoke all on function private.track_subscription_account_history() from public, anon, authenticated;

create trigger track_subscription_account_history
after insert or update of service_account_id on public.subscriptions
for each row execute function private.track_subscription_account_history();
