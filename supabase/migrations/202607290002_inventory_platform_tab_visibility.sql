alter table public.services
  add column if not exists show_in_inventory_tabs boolean not null default true;
