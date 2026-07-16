drop index if exists public.customers_phone_normalized_unique;

create index if not exists customers_phone_normalized_idx
on public.customers(phone_normalized)
where phone_normalized is not null;
