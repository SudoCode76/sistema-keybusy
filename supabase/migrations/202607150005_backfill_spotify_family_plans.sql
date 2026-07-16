insert into public.spotify_family_plans(service_account_id, seats_total)
select sa.id, 6
from public.service_accounts sa
join public.services s on s.id = sa.service_id
left join public.spotify_family_plans sfp on sfp.service_account_id = sa.id
where s.slug = 'spotify'
  and sfp.service_account_id is null
on conflict (service_account_id) do nothing;
