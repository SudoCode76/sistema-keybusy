insert into public.spotify_family_plans(service_account_id, seats_total)
select sa.id, 6
from public.service_accounts sa
join public.services s on s.id = sa.service_id
left join public.spotify_family_plans sfp on sfp.service_account_id = sa.id
where s.slug = 'spotify'
  and sfp.service_account_id is null
on conflict (service_account_id) do nothing;

do $$
declare
  conflicts text;
begin
  select string_agg(s.id::text, ', ' order by s.id::text)
  into conflicts
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where p.slug = 'spotify_family_member'
    and s.status not in ('canceled', 'inactive')
    and s.service_account_id is null;

  if conflicts is not null then
    raise exception 'Suscripciones Spotify sin plan familiar: %', conflicts;
  end if;

  select string_agg(s.id::text, ', ' order by s.id::text)
  into conflicts
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  left join public.service_accounts sa on sa.id = s.service_account_id
  left join public.spotify_family_plans sfp
    on sfp.service_account_id = s.service_account_id
  where p.slug = 'spotify_family_member'
    and s.status not in ('canceled', 'inactive')
    and (
      sa.id is null
      or sa.service_id <> p.service_id
      or sfp.service_account_id is null
    );

  if conflicts is not null then
    raise exception 'Suscripciones Spotify con enlace de plan invalido: %', conflicts;
  end if;

  select string_agg(plan_id::text, ', ' order by plan_id::text)
  into conflicts
  from (
    select s.service_account_id as plan_id
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    join public.spotify_family_plans sfp
      on sfp.service_account_id = s.service_account_id
    where p.slug = 'spotify_family_member'
      and s.status not in ('canceled', 'inactive')
    group by s.service_account_id, sfp.seats_total
    having count(*) > sfp.seats_total
  ) over_capacity;

  if conflicts is not null then
    raise exception 'Planes Spotify sobrevendidos: %', conflicts;
  end if;

  select string_agg(plan_id::text, ', ' order by plan_id::text)
  into conflicts
  from (
    select s.service_account_id as plan_id
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    join public.service_accounts sa on sa.id = s.service_account_id
    join public.subscription_access_details sad on sad.subscription_id = s.id
    where p.slug = 'spotify_family_member'
      and s.status not in ('canceled', 'inactive')
      and nullif(btrim(sa.login_email), '') is not null
      and lower(btrim(sad.login_email)) = lower(btrim(sa.login_email))
    group by s.service_account_id
    having count(*) > 1
  ) duplicate_owners;

  if conflicts is not null then
    raise exception 'Planes Spotify con varios titulares inferidos: %', conflicts;
  end if;
end;
$$;

update public.subscriptions s
set slot_label = case
  when exists (
    select 1
    from public.subscription_access_details sad
    where sad.subscription_id = s.id
      and nullif(btrim(sa.login_email), '') is not null
      and lower(btrim(sad.login_email)) = lower(btrim(sa.login_email))
  ) then 'Titular'
  else 'Miembro familiar'
end
from public.products p, public.service_accounts sa
where p.id = s.product_id
  and p.slug = 'spotify_family_member'
  and sa.id = s.service_account_id;

update public.subscription_access_details sad
set profile_label = s.slot_label
from public.subscriptions s
join public.products p on p.id = s.product_id
where sad.subscription_id = s.id
  and p.slug = 'spotify_family_member';

create or replace function public.enforce_spotify_family_seat()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  product_service_id uuid;
  plan_seats integer;
  occupied_seats integer;
begin
  select p.service_id
  into product_service_id
  from public.products p
  where p.id = new.product_id
    and p.slug = 'spotify_family_member';

  if product_service_id is null then
    return new;
  end if;

  if new.service_account_id is null then
    raise exception 'Spotify requiere un plan familiar enlazado';
  end if;

  new.slot_label := coalesce(nullif(btrim(new.slot_label), ''), 'Miembro familiar');
  if new.slot_label not in ('Titular', 'Miembro familiar') then
    raise exception 'El tipo de cupo Spotify debe ser Titular o Miembro familiar';
  end if;

  if new.status in ('canceled', 'inactive') then
    return new;
  end if;

  select sfp.seats_total
  into plan_seats
  from public.spotify_family_plans sfp
  join public.service_accounts sa on sa.id = sfp.service_account_id
  where sfp.service_account_id = new.service_account_id
    and sa.service_id = product_service_id
    and sa.status = 'active'
  for update of sfp;

  if plan_seats is null then
    raise exception 'La cuenta seleccionada no es un plan familiar Spotify activo';
  end if;

  select count(*)
  into occupied_seats
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.service_account_id = new.service_account_id
    and p.slug = 'spotify_family_member'
    and s.status not in ('canceled', 'inactive')
    and s.id is distinct from new.id;

  if occupied_seats >= plan_seats then
    raise exception 'El plan familiar Spotify ya tiene sus % cupos ocupados', plan_seats;
  end if;

  if new.slot_label = 'Titular' and exists (
    select 1
    from public.subscriptions s
    join public.products p on p.id = s.product_id
    where s.service_account_id = new.service_account_id
      and p.slug = 'spotify_family_member'
      and s.status not in ('canceled', 'inactive')
      and s.slot_label = 'Titular'
      and s.id is distinct from new.id
  ) then
    raise exception 'Este plan familiar Spotify ya tiene un titular asignado';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_spotify_family_seat on public.subscriptions;
create trigger enforce_spotify_family_seat
before insert or update of product_id, service_account_id, slot_label, status
on public.subscriptions
for each row
execute function public.enforce_spotify_family_seat();
