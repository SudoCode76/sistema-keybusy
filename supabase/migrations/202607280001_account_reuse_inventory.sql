alter table public.products
  add column if not exists allow_account_reuse_on_cancel boolean not null default false;

alter table public.subscriptions
  add column if not exists account_deactivated_on_cancel boolean not null default false;

update public.products
set allow_account_reuse_on_cancel = true
where slug in ('chatgpt_private', 'hbo_profile', 'hbo_max_profile');

create or replace function public.cancel_subscription(
  p_subscription_id uuid,
  p_keep_account_available boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sale record;
  account_was_deactivated boolean := false;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  select s.id, s.status, s.service_account_id, p.purchase_mode, p.allow_account_reuse_on_cancel
  into sale
  from public.subscriptions s
  join public.products p on p.id = s.product_id
  where s.id = p_subscription_id
  for update of s;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if sale.status = 'canceled' then
    return;
  end if;

  update public.subscriptions
  set status = 'canceled', account_deactivated_on_cancel = false
  where id = p_subscription_id;

  update public.billing_cycles
  set status = 'canceled'
  where subscription_id = p_subscription_id and status = 'pending';

  if sale.service_account_id is not null
     and sale.purchase_mode = 'individual'
     and not (sale.allow_account_reuse_on_cancel and p_keep_account_available)
     and not exists (
       select 1
       from public.subscriptions other_sale
       where other_sale.service_account_id = sale.service_account_id
         and other_sale.id <> p_subscription_id
         and other_sale.status = 'active'
     ) then
    update public.service_accounts
    set status = 'inactive'
    where id = sale.service_account_id and status = 'active';
    account_was_deactivated := found;
  end if;

  update public.subscriptions
  set account_deactivated_on_cancel = account_was_deactivated
  where id = p_subscription_id;
end;
$$;

create or replace function public.reactivate_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  sale record;
begin
  if not private.is_admin() then
    raise exception 'Admin required';
  end if;

  select service_account_id, account_deactivated_on_cancel
  into sale
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  update public.subscriptions
  set status = 'active', account_deactivated_on_cancel = false
  where id = p_subscription_id;

  if sale.account_deactivated_on_cancel and sale.service_account_id is not null then
    update public.service_accounts
    set status = 'active'
    where id = sale.service_account_id and status = 'inactive';
  end if;
end;
$$;

revoke all on function public.cancel_subscription(uuid, boolean) from public, anon;
grant execute on function public.cancel_subscription(uuid, boolean) to authenticated;
revoke all on function public.reactivate_subscription(uuid) from public, anon;
grant execute on function public.reactivate_subscription(uuid) to authenticated;
