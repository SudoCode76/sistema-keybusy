-- Keep the subscription price monthly, but charge the full purchased period.
with cycle_prices as (
  select
    bc.id,
    s.current_price_amount * greatest(1, (
      extract(year from age(bc.period_end, bc.period_start))::integer * 12
      + extract(month from age(bc.period_end, bc.period_start))::integer
    )) as total,
    s.current_price_currency as currency,
    s.current_exchange_rate as rate
  from public.billing_cycles bc
  join public.subscriptions s on s.id = bc.subscription_id
)
update public.billing_cycles bc
set
  expected_amount = round(cp.total, 2),
  expected_bob = case
    when cp.currency = 'BOB' then round(cp.total, 2)
    when cp.rate > 0 then round(cp.total * cp.rate, 2)
    else 0
  end,
  expected_usdt = case
    when cp.currency = 'USDT' then round(cp.total, 2)
    when cp.rate > 0 then round(cp.total / cp.rate, 2)
    else 0
  end
from cycle_prices cp
where cp.id = bc.id;

update public.payments p
set
  amount = bc.expected_amount,
  currency = bc.expected_currency,
  exchange_rate = bc.exchange_rate,
  amount_bob = bc.expected_bob,
  amount_usdt = bc.expected_usdt
from public.billing_cycles bc
where bc.id = p.billing_cycle_id;

create or replace function private.set_billing_cycle_period_total()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  months integer;
begin
  if tg_op = 'UPDATE'
    and new.expected_amount is not distinct from old.expected_amount
    and new.expected_currency is not distinct from old.expected_currency
    and new.exchange_rate is not distinct from old.exchange_rate
    and new.period_start is not distinct from old.period_start
    and new.period_end is not distinct from old.period_end then
    return new;
  end if;

  months := greatest(1, (
    extract(year from age(new.period_end, new.period_start))::integer * 12
    + extract(month from age(new.period_end, new.period_start))::integer
  ));

  new.expected_amount := round(new.expected_amount * months, 2);
  new.expected_bob := case
    when new.expected_currency = 'BOB' then new.expected_amount
    when new.exchange_rate > 0 then round(new.expected_amount * new.exchange_rate, 2)
    else 0
  end;
  new.expected_usdt := case
    when new.expected_currency = 'USDT' then new.expected_amount
    when new.exchange_rate > 0 then round(new.expected_amount / new.exchange_rate, 2)
    else 0
  end;

  return new;
end;
$$;

drop trigger if exists set_billing_cycle_period_total on public.billing_cycles;
create trigger set_billing_cycle_period_total
before insert or update on public.billing_cycles
for each row execute function private.set_billing_cycle_period_total();

create or replace function private.set_payment_from_billing_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.billing_cycle_id is null then
    return new;
  end if;

  select expected_amount, expected_currency, exchange_rate, expected_bob, expected_usdt
  into new.amount, new.currency, new.exchange_rate, new.amount_bob, new.amount_usdt
  from public.billing_cycles
  where id = new.billing_cycle_id;

  return new;
end;
$$;

drop trigger if exists set_payment_from_billing_cycle on public.payments;
create trigger set_payment_from_billing_cycle
before insert or update of amount, currency, exchange_rate, billing_cycle_id on public.payments
for each row execute function private.set_payment_from_billing_cycle();
