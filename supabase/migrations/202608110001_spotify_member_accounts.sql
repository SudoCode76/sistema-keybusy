alter table public.subscriptions
  add column if not exists spotify_member_account_id uuid;

create table if not exists public.spotify_member_accounts (
  id uuid primary key default gen_random_uuid(),
  service_account_id uuid not null references public.service_accounts(id) on delete restrict,
  source_subscription_id uuid references public.subscriptions(id) on delete set null,
  current_subscription_id uuid references public.subscriptions(id) on delete set null,
  login_email text not null,
  login_password text,
  email_password text,
  invitation_email text,
  status text not null default 'available' check (status in ('assigned', 'available', 'removed')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.spotify_member_accounts enable row level security;
drop policy if exists "spotify_member_accounts_admin_all" on public.spotify_member_accounts;
create policy "spotify_member_accounts_admin_all"
on public.spotify_member_accounts
for all using (private.is_admin()) with check (private.is_admin());

create unique index if not exists spotify_member_accounts_email_unique
on public.spotify_member_accounts(service_account_id, lower(btrim(login_email)));
create index if not exists spotify_member_accounts_service_account_idx
on public.spotify_member_accounts(service_account_id, status);
create index if not exists spotify_member_accounts_current_subscription_idx
on public.spotify_member_accounts(current_subscription_id);
create index if not exists subscriptions_spotify_member_account_idx
on public.subscriptions(spotify_member_account_id)
where spotify_member_account_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_spotify_member_account_id_fkey'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_spotify_member_account_id_fkey
      foreign key (spotify_member_account_id)
      references public.spotify_member_accounts(id)
      on delete set null;
  end if;
end $$;

with candidates as (
  select distinct on (s.service_account_id, lower(btrim(d.login_email)))
    s.service_account_id,
    s.id as subscription_id,
    btrim(d.login_email) as login_email,
    d.login_password,
    d.email_password,
    d.invitation_email,
    s.status,
    s.updated_at
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  join public.subscription_access_details d on d.subscription_id = s.id
  where p.slug = 'spotify_family_member'
    and s.service_account_id is not null
    and s.slot_label <> 'Titular'
    and nullif(btrim(d.login_email), '') is not null
  order by s.service_account_id, lower(btrim(d.login_email)),
    case when s.status = 'active' then 0 else 1 end,
    s.updated_at desc
)
insert into public.spotify_member_accounts(
  service_account_id,
  source_subscription_id,
  current_subscription_id,
  login_email,
  login_password,
  email_password,
  invitation_email,
  status
)
select
  service_account_id,
  case when status = 'active' then null else subscription_id end,
  case when status = 'active' then subscription_id else null end,
  login_email,
  login_password,
  email_password,
  invitation_email,
  case when status = 'active' then 'assigned' else 'available' end
from candidates
on conflict do nothing;

update public.subscriptions s
set spotify_member_account_id = m.id
from public.products p,
     public.subscription_access_details d,
     public.spotify_member_accounts m
where s.product_id = p.id
  and d.subscription_id = s.id
  and m.service_account_id = s.service_account_id
  and lower(btrim(m.login_email)) = lower(btrim(d.login_email))
  and p.slug = 'spotify_family_member'
  and s.slot_label <> 'Titular'
  and s.service_account_id is not null;

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
    return new;
  end if;

  if nullif(btrim(new.login_email), '') is null then
    return new;
  end if;

  select sa.seat_capacity into capacity
  from public.service_accounts sa
  where sa.id = sale.service_account_id
  for update;

  if tg_op = 'UPDATE'
     and lower(btrim(coalesce(old.login_email, ''))) is distinct from lower(btrim(new.login_email)) then
    update public.spotify_member_accounts
    set current_subscription_id = null,
        source_subscription_id = sale.id,
        status = case when status = 'removed' then 'removed' else 'available' end,
        updated_at = now()
    where current_subscription_id = sale.id
      and lower(btrim(login_email)) = lower(btrim(coalesce(old.login_email, '')));
  end if;

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

drop trigger if exists sync_spotify_member_account on public.subscription_access_details;
create trigger sync_spotify_member_account
after insert or update of login_email, login_password, email_password, invitation_email
on public.subscription_access_details
for each row execute function public.sync_spotify_member_account();

create or replace function public.sync_spotify_member_status()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  member record;
begin
  if new.spotify_member_account_id is not null then
    select * into member
    from public.spotify_member_accounts
    where id = new.spotify_member_account_id
    for update;
    if new.status = 'active' and member.status = 'removed' then
      raise exception 'El miembro Spotify fue eliminado y no puede reactivarse';
    end if;
    if new.status = 'active'
       and member.current_subscription_id is not null
       and member.current_subscription_id <> new.id then
      raise exception 'El miembro Spotify ya fue reasignado a otro cliente';
    end if;
    update public.spotify_member_accounts
    set current_subscription_id = case when new.status = 'active' then new.id else null end,
        source_subscription_id = case when new.status = 'active' then source_subscription_id else new.id end,
        status = case when status = 'removed' then 'removed' else case when new.status = 'active' then 'assigned' else 'available' end end,
        updated_at = now()
    where id = new.spotify_member_account_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_spotify_member_status on public.subscriptions;
create trigger sync_spotify_member_status
after update of status on public.subscriptions
for each row execute function public.sync_spotify_member_status();

create or replace function public.remove_spotify_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  member record;
begin
  if not private.is_admin() then raise exception 'Admin required'; end if;
  select m.*, s.status as current_status
  into member
  from public.spotify_member_accounts m
  left join public.subscriptions s on s.id = m.current_subscription_id
  where m.id = p_member_id
  for update of m;
  if not found then raise exception 'Miembro Spotify no encontrado'; end if;
  if member.status = 'removed' then return; end if;
  if member.current_subscription_id is not null and member.current_status = 'active' then
    raise exception 'No puedes eliminar un miembro asignado a un cliente activo';
  end if;
  update public.spotify_member_accounts
  set status = 'removed', current_subscription_id = null, removed_at = now(), updated_at = now()
  where id = p_member_id;
end;
$$;

revoke all on function public.remove_spotify_member(uuid) from public, anon;
grant execute on function public.remove_spotify_member(uuid) to authenticated;
revoke all on function public.sync_spotify_member_account() from public, anon, authenticated;
revoke all on function public.sync_spotify_member_status() from public, anon, authenticated;
