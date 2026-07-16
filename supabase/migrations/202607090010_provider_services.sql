create table if not exists public.provider_services (
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (provider_id, service_id)
);

alter table public.provider_services enable row level security;

create policy "provider_services_admin_all"
on public.provider_services
for all
using (private.is_admin())
with check (private.is_admin());
