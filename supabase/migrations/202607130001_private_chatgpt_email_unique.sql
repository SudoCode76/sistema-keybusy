do $$
declare
  chatgpt_private_service_id uuid;
begin
  select id into chatgpt_private_service_id
  from public.services
  where slug = 'chatgpt-private';

  if chatgpt_private_service_id is null then
    raise exception 'No existe el servicio chatgpt-private';
  end if;

  if exists (
    select 1
    from public.service_accounts
    where service_id = chatgpt_private_service_id
      and nullif(btrim(login_email), '') is not null
    group by lower(btrim(login_email))
    having count(*) > 1
  ) then
    raise exception 'Existen correos ChatGPT privados duplicados; revisalos antes de aplicar la migracion';
  end if;

  execute format(
    'create unique index if not exists service_accounts_chatgpt_private_email_unique
     on public.service_accounts (lower(btrim(login_email)))
     where service_id = %L::uuid and nullif(btrim(login_email), '''') is not null',
    chatgpt_private_service_id
  );
end;
$$;
