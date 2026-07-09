create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function private.is_customer_owner(customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customers
    where id = customer_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "customers_admin_all" on public.customers;
drop policy if exists "customers_select_own" on public.customers;
drop policy if exists "providers_admin_all" on public.providers;
drop policy if exists "services_admin_all" on public.services;
drop policy if exists "services_customer_read" on public.services;
drop policy if exists "products_admin_all" on public.products;
drop policy if exists "products_customer_read" on public.products;
drop policy if exists "email_addresses_admin_all" on public.email_addresses;
drop policy if exists "exchange_rate_snapshots_admin_all" on public.exchange_rate_snapshots;
drop policy if exists "service_accounts_admin_all" on public.service_accounts;
drop policy if exists "account_credentials_admin_all" on public.account_credentials;
drop policy if exists "spotify_family_plans_admin_all" on public.spotify_family_plans;
drop policy if exists "subscriptions_admin_all" on public.subscriptions;
drop policy if exists "subscriptions_customer_read" on public.subscriptions;
drop policy if exists "billing_cycles_admin_all" on public.billing_cycles;
drop policy if exists "billing_cycles_customer_read" on public.billing_cycles;
drop policy if exists "payments_admin_all" on public.payments;
drop policy if exists "payments_customer_read" on public.payments;
drop policy if exists "costs_admin_all" on public.costs;
drop policy if exists "email_usages_admin_all" on public.email_usages;

create policy "profiles_select_self_or_admin" on public.profiles for select using (id = (select auth.uid()) or private.is_admin());
create policy "profiles_admin_all" on public.profiles for all using (private.is_admin()) with check (private.is_admin());
create policy "profiles_update_self" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "customers_admin_all" on public.customers for all using (private.is_admin()) with check (private.is_admin());
create policy "customers_select_own" on public.customers for select using (profile_id = (select auth.uid()));
create policy "providers_admin_all" on public.providers for all using (private.is_admin()) with check (private.is_admin());
create policy "services_admin_all" on public.services for all using (private.is_admin()) with check (private.is_admin());
create policy "services_customer_read" on public.services for select using ((select auth.uid()) is not null);
create policy "products_admin_all" on public.products for all using (private.is_admin()) with check (private.is_admin());
create policy "products_customer_read" on public.products for select using ((select auth.uid()) is not null);
create policy "email_addresses_admin_all" on public.email_addresses for all using (private.is_admin()) with check (private.is_admin());
create policy "exchange_rate_snapshots_admin_all" on public.exchange_rate_snapshots for all using (private.is_admin()) with check (private.is_admin());
create policy "service_accounts_admin_all" on public.service_accounts for all using (private.is_admin()) with check (private.is_admin());
create policy "account_credentials_admin_all" on public.account_credentials for all using (private.is_admin()) with check (private.is_admin());
create policy "spotify_family_plans_admin_all" on public.spotify_family_plans for all using (private.is_admin()) with check (private.is_admin());
create policy "subscriptions_admin_all" on public.subscriptions for all using (private.is_admin()) with check (private.is_admin());
create policy "subscriptions_customer_read" on public.subscriptions for select using (private.is_customer_owner(customer_id));
create policy "billing_cycles_admin_all" on public.billing_cycles for all using (private.is_admin()) with check (private.is_admin());
create policy "billing_cycles_customer_read" on public.billing_cycles for select using (
  exists (
    select 1 from public.subscriptions s
    where s.id = subscription_id
      and private.is_customer_owner(s.customer_id)
  )
);
create policy "payments_admin_all" on public.payments for all using (private.is_admin()) with check (private.is_admin());
create policy "payments_customer_read" on public.payments for select using (private.is_customer_owner(customer_id));
create policy "costs_admin_all" on public.costs for all using (private.is_admin()) with check (private.is_admin());
create policy "email_usages_admin_all" on public.email_usages for all using (private.is_admin()) with check (private.is_admin());

drop function if exists public.is_admin();
drop function if exists public.is_customer_owner(uuid);
