do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.update_sale(uuid, jsonb)'::regprocedure)
  into function_definition;

  if position('select s.customer_id, s.product_id, s.service_account_id, s.slot_label, s.ends_on' in function_definition) = 0 then
    if position('select s.customer_id, s.product_id, s.service_account_id, s.slot_label' in function_definition) = 0 then
      raise exception 'Expected update_sale current-sale select was not found';
    end if;

    function_definition := replace(
      function_definition,
      'select s.customer_id, s.product_id, s.service_account_id, s.slot_label',
      'select s.customer_id, s.product_id, s.service_account_id, s.slot_label, s.ends_on'
    );
  end if;

  execute function_definition;
end;
$migration$;
