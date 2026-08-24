create or replace function public.preserve_overdue_account_issue()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  today_date date := timezone('America/La_Paz', now())::date;
begin
  if old.renewal_due_on is not null
    and old.renewal_due_on <= today_date
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

create or replace function public.resolve_mother_access_issue(p_subscription_id uuid)
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
    sub.access_restored_on,
    sa.id as account_id,
    sa.renewal_due_on,
    sa.access_issue_on,
    sv.slug as service_slug,
    sv.account_model
  into sale
  from public.subscriptions sub
  join public.service_accounts sa on sa.id = sub.service_account_id
  join public.services sv on sv.id = sa.service_id
  where sub.id = p_subscription_id
  for update of sub, sa;

  if sale.account_id is null then
    raise exception 'Acceso no encontrado';
  end if;

  if sale.account_model <> 'mother'
    or sale.status in ('canceled', 'inactive')
    or sale.ends_on <= today_date
  then
    raise exception 'El acceso no tiene una incidencia vigente de cuenta madre';
  end if;

  issue_on := case
    when sale.renewal_due_on is not null and sale.renewal_due_on <= today_date
      then case
        when sale.access_issue_on is null then sale.renewal_due_on
        else greatest(sale.access_issue_on, sale.renewal_due_on)
      end
    else sale.access_issue_on
  end;

  if issue_on is null
    or sale.created_on > issue_on
    or (sale.access_restored_on is not null and sale.access_restored_on >= issue_on)
  then
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

revoke all on function public.resolve_mother_access_issue(uuid) from public, anon;
grant execute on function public.resolve_mother_access_issue(uuid) to authenticated;
