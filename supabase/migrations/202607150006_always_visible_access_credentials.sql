insert into public.subscription_access_details (
  subscription_id,
  login_email,
  login_password,
  email_password,
  visible_to_customer,
  visible_fields
)
select
  s.id,
  coalesce(nullif(sa.login_email, ''), nullif(e.email, '')),
  coalesce(secrets.platform_password, secrets.password),
  coalesce(nullif(e.email_password, ''), secrets.email_password),
  true,
  '{}'::text[]
from public.subscriptions s
join public.service_accounts sa on sa.id = s.service_account_id
left join public.email_addresses e on e.id = sa.email_address_id
left join public.account_credentials ac on ac.service_account_id = sa.id
left join lateral (
  select
    max(regexp_replace(line, '^[^:]+:\s*', '')) filter (
      where btrim(split_part(line, ':', 1)) = 'platform_password'
    ) as platform_password,
    max(regexp_replace(line, '^[^:]+:\s*', '')) filter (
      where btrim(split_part(line, ':', 1)) = 'password'
    ) as password,
    max(regexp_replace(line, '^[^:]+:\s*', '')) filter (
      where btrim(split_part(line, ':', 1)) = 'email_password'
    ) as email_password
  from unnest(string_to_array(ac.secret_payload, E'\n')) as line
) secrets on true
where nullif(sa.login_email, '') is not null
   or nullif(e.email, '') is not null
   or nullif(e.email_password, '') is not null
   or secrets.platform_password is not null
   or secrets.password is not null
   or secrets.email_password is not null
on conflict (subscription_id) do update
set
  login_email = coalesce(
    public.subscription_access_details.login_email,
    excluded.login_email
  ),
  login_password = coalesce(
    public.subscription_access_details.login_password,
    excluded.login_password
  ),
  email_password = coalesce(
    public.subscription_access_details.email_password,
    excluded.email_password
  );

update public.subscription_access_details
set
  visible_to_customer = true,
  visible_fields = array_remove(array[
    case when nullif(login_email, '') is not null then 'login_email' end,
    case when nullif(login_password, '') is not null then 'login_password' end,
    case when nullif(email_password, '') is not null then 'email_password' end,
    case when nullif(invitation_email, '') is not null then 'invitation_email' end,
    case when nullif(profile_label, '') is not null then 'profile_label' end
  ], null);
