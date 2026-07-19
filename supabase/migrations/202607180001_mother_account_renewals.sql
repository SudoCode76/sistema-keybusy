alter table public.service_accounts
add column if not exists renewal_due_on date,
add column if not exists access_issue_on date;

alter table public.subscriptions
add column if not exists access_restored_on date;

create or replace function public.preserve_overdue_account_issue()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  today_date date := timezone('America/La_Paz', now())::date;
begin
  if old.renewal_due_on is not null
    and old.renewal_due_on < today_date
    and new.renewal_due_on is distinct from old.renewal_due_on
  then
    new.access_issue_on := case
      when new.access_issue_on is null then old.renewal_due_on
      else greatest(new.access_issue_on, old.renewal_due_on)
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists preserve_overdue_account_issue on public.service_accounts;
create trigger preserve_overdue_account_issue
before update of renewal_due_on on public.service_accounts
for each row execute function public.preserve_overdue_account_issue();

create or replace function public.renew_mother_account(
  p_service_account_id uuid,
  p_next_renewal_on date,
  p_amount numeric,
  p_currency public.currency_code,
  p_exchange_rate numeric,
  p_amount_bob numeric,
  p_amount_usdt numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  account_row record;
  cost_id uuid;
  today_date date := timezone('America/La_Paz', now())::date;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  if p_next_renewal_on is null or p_next_renewal_on <= today_date then
    raise exception 'El próximo pago debe ser posterior a hoy';
  end if;

  if p_amount is null or p_amount < 0
    or p_amount_bob is null or p_amount_bob < 0
    or p_amount_usdt is null or p_amount_usdt < 0
    or (p_exchange_rate is not null and p_exchange_rate <= 0)
  then
    raise exception 'Los importes de renovación no son válidos';
  end if;

  select sa.provider_id, sa.status, sv.slug as service_slug
  into account_row
  from public.service_accounts sa
  join public.services sv on sv.id = sa.service_id
  where sa.id = p_service_account_id
  for update of sa;

  if account_row.service_slug is null then
    raise exception 'Cuenta de inventario no encontrada';
  end if;

  if account_row.status <> 'active'
    or account_row.service_slug not in ('spotify', 'netflix')
  then
    raise exception 'La cuenta no es una cuenta madre activa de Spotify o Netflix';
  end if;

  update public.service_accounts
  set renewal_due_on = p_next_renewal_on
  where id = p_service_account_id;

  insert into public.costs(
    service_account_id,
    provider_id,
    cost_type,
    amount,
    currency,
    exchange_rate,
    amount_bob,
    amount_usdt,
    notes
  )
  values (
    p_service_account_id,
    account_row.provider_id,
    'renewal',
    p_amount,
    p_currency,
    p_exchange_rate,
    p_amount_bob,
    p_amount_usdt,
    nullif(btrim(p_notes), '')
  )
  returning id into cost_id;

  return cost_id;
end;
$$;

create or replace function public.resolve_mother_access_issue(
  p_subscription_id uuid
)
returns date
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sale record;
  issue_on date;
  today_date date := timezone('America/La_Paz', now())::date;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  select
    sub.created_at::date as created_on,
    sub.status,
    sub.ends_on,
    sa.id as account_id,
    sa.renewal_due_on,
    sa.access_issue_on,
    sv.slug as service_slug
  into sale
  from public.subscriptions sub
  join public.service_accounts sa on sa.id = sub.service_account_id
  join public.services sv on sv.id = sa.service_id
  where sub.id = p_subscription_id
  for update of sub, sa;

  if sale.account_id is null then
    raise exception 'Acceso no encontrado';
  end if;

  if sale.service_slug not in ('spotify', 'netflix')
    or sale.status in ('canceled', 'inactive')
    or sale.ends_on < today_date
  then
    raise exception 'El acceso no tiene una incidencia vigente de cuenta madre';
  end if;

  issue_on := case
    when sale.renewal_due_on is not null and sale.renewal_due_on < today_date
      then case
        when sale.access_issue_on is null then sale.renewal_due_on
        else greatest(sale.access_issue_on, sale.renewal_due_on)
      end
    else sale.access_issue_on
  end;

  if issue_on is null or sale.created_on > issue_on then
    raise exception 'El acceso no está afectado por la cuenta madre';
  end if;

  update public.service_accounts
  set access_issue_on = case
    when access_issue_on is null then issue_on
    else greatest(access_issue_on, issue_on)
  end
  where id = sale.account_id;

  update public.subscriptions
  set access_restored_on = today_date
  where id = p_subscription_id;

  return issue_on;
end;
$$;

revoke all on function public.preserve_overdue_account_issue() from public, anon, authenticated;
revoke all on function public.renew_mother_account(
  uuid,
  date,
  numeric,
  public.currency_code,
  numeric,
  numeric,
  numeric,
  text
) from public, anon;
grant execute on function public.renew_mother_account(
  uuid,
  date,
  numeric,
  public.currency_code,
  numeric,
  numeric,
  numeric,
  text
) to authenticated;
revoke all on function public.resolve_mother_access_issue(uuid) from public, anon;
grant execute on function public.resolve_mother_access_issue(uuid) to authenticated;
