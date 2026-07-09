alter view public.monthly_revenue_summary set (security_invoker = true);
alter view public.subscription_status_view set (security_invoker = true);
alter view public.account_profit_view set (security_invoker = true);
alter view public.customer_portal_orders_view set (security_invoker = true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.claim_first_admin() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_customer_owner(uuid) from anon;

create index if not exists costs_provider_id_idx on public.costs(provider_id);
create index if not exists costs_service_account_id_idx on public.costs(service_account_id);
create index if not exists email_usages_email_address_id_idx on public.email_usages(email_address_id);
create index if not exists email_usages_service_account_id_idx on public.email_usages(service_account_id);
create index if not exists email_usages_subscription_id_idx on public.email_usages(subscription_id);
create index if not exists payments_billing_cycle_id_idx on public.payments(billing_cycle_id);
create index if not exists payments_customer_id_idx on public.payments(customer_id);
create index if not exists payments_subscription_id_idx on public.payments(subscription_id);
create index if not exists products_service_id_idx on public.products(service_id);
create index if not exists service_accounts_email_address_id_idx on public.service_accounts(email_address_id);
create index if not exists service_accounts_replacement_account_id_idx on public.service_accounts(replacement_account_id);
create index if not exists subscriptions_product_id_idx on public.subscriptions(product_id);
