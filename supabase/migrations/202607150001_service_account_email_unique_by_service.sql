undado $$
begin
  if exists (
    select 1
    from public.service_accounts
    where nullif(btrim(login_email), '') is not null
    group by service_id, lower(btrim(login_email))
    having count(*) > 1
  ) then
    raise exception 'Existen correos duplicados dentro del mismo servicio; revisalos antes de aplicar la migracion';
  end if;
end;
$$;

create unique index if not exists service_accounts_service_email_unique
on public.service_accounts (service_id, lower(btrim(login_email)))
where nullif(btrim(login_email), '') is not null;

drop index if exists public.service_accounts_chatgpt_private_email_unique;
