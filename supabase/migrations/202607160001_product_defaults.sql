alter table public.products
  add column if not exists is_default boolean not null default false;

with ranked_products as (
  select
    id,
    row_number() over (
      partition by service_id
      order by
        case when slug = 'chatgpt_private' then 0 else 1 end,
        name,
        id
    ) as position
  from public.products
  where status = 'active'
)
update public.products as products
set is_default = true
from ranked_products
where products.id = ranked_products.id
  and ranked_products.position = 1;

create unique index if not exists products_one_default_per_service_idx
  on public.products(service_id)
  where is_default;

create or replace function public.set_default_product(p_product_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_service_id uuid;
begin
  select service_id
  into target_service_id
  from public.products
  where id = p_product_id
    and status = 'active';

  if target_service_id is null then
    raise exception 'El item no existe o esta inactivo';
  end if;

  update public.products
  set is_default = false
  where service_id = target_service_id
    and is_default;

  update public.products
  set is_default = true
  where id = p_product_id;
end;
$$;

grant execute on function public.set_default_product(uuid) to authenticated;
