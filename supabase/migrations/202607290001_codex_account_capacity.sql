create or replace function private.enforce_single_chatgpt_codex_sale()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status = 'active'
     and new.service_account_id is not null
     and exists (
       select 1
       from public.products p
       where p.id = new.product_id
         and p.slug = 'chatgpt_codex'
     ) then
    perform pg_advisory_xact_lock(
      hashtextextended(new.service_account_id::text || ':chatgpt_codex', 0)
    );

    if exists (
      select 1
      from public.subscriptions s
      join public.products p on p.id = s.product_id
      where s.service_account_id = new.service_account_id
        and s.status = 'active'
        and p.slug = 'chatgpt_codex'
        and (new.id is null or s.id <> new.id)
    ) then
      raise exception 'Esta cuenta ya tiene una venta Codex activa';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_single_chatgpt_codex_sale on public.subscriptions;

create trigger enforce_single_chatgpt_codex_sale
before insert or update of service_account_id, product_id, status
on public.subscriptions
for each row
execute function private.enforce_single_chatgpt_codex_sale();

revoke all on function private.enforce_single_chatgpt_codex_sale() from public, anon, authenticated;
