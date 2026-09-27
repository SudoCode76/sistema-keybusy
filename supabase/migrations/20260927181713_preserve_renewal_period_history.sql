do $migration$
declare
  function_definition text;
  block_start integer;
  block_end integer;
begin
  select pg_get_functiondef('public.update_sale(uuid, jsonb)'::regprocedure)
  into function_definition;

  if position('current_cycle_id' in function_definition) = 0 then
    block_start := strpos(
      function_definition,
      '  select id into initial_cycle_id from public.billing_cycles'
    );
    block_end := block_start - 1 + strpos(
      substring(function_definition from block_start),
      '  visible_fields :='
    );

    if block_start = 0 or block_end = 0 then
      raise exception 'Expected original billing-cycle edit block was not found';
    end if;

    function_definition := replace(
      function_definition,
      '  initial_cycle_id uuid;',
      '  current_cycle_id uuid;'
    );
    function_definition :=
      substring(function_definition from 1 for block_start - 1)
      || E'  select id into current_cycle_id from public.billing_cycles where subscription_id = p_subscription_id order by created_at desc, period_start desc limit 1;\n  if current_cycle_id is not null then\n    update public.billing_cycles set period_start = edit.starts_on, period_end = edit.ends_on, due_on = edit.starts_on, expected_amount = edit.price_amount, expected_currency = edit.price_currency, exchange_rate = edit.exchange_rate, expected_bob = sale_bob, expected_usdt = sale_usdt, updated_at = now() where id = current_cycle_id;\n  end if;\n\n'
      || substring(function_definition from block_end);

    block_start := strpos(
      function_definition,
      '  select id into initial_payment_id from public.payments'
    );
    block_end := block_start - 1 + strpos(
      substring(function_definition from block_start),
      '  visible_fields :='
    );

    if block_start = 0 or block_end = 0 then
      raise exception 'Expected initial payment edit block was not found';
    end if;

    function_definition := replace(
      function_definition,
      '  initial_payment_id uuid;',
      ''
    );
    function_definition :=
      substring(function_definition from 1 for block_start - 1)
      || substring(function_definition from block_end);
  else
    function_definition := replace(
      function_definition,
      'order by period_start desc, created_at desc limit 1',
      'order by created_at desc, period_start desc limit 1'
    );

    block_start := strpos(
      function_definition,
      '  select id into initial_payment_id from public.payments'
    );
    block_end := block_start - 1 + strpos(
      substring(function_definition from block_start),
      '  visible_fields :='
    );

    if block_start = 0 or block_end = 0 then
      raise exception 'Expected initial payment edit block was not found';
    end if;

    function_definition :=
      substring(function_definition from 1 for block_start - 1)
      || substring(function_definition from block_end);
  end if;

  execute function_definition;
end;
$migration$;
