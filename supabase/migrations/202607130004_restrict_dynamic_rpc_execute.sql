revoke all on function public.create_platform_with_product(
  text, text, text, text, text, text, text, text[], integer, numeric,
  public.currency_code, numeric, numeric, public.currency_code, numeric
) from public, anon;

grant execute on function public.create_platform_with_product(
  text, text, text, text, text, text, text, text[], integer, numeric,
  public.currency_code, numeric, numeric, public.currency_code, numeric
) to authenticated;

revoke all on function public.create_sale_with_email(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text,
  uuid, boolean, uuid, text, uuid
) from public, anon;

grant execute on function public.create_sale_with_email(
  text, text, uuid, uuid, text, text, text, text, text, text, text, date,
  integer, numeric, public.currency_code, numeric, boolean, boolean, text[], text,
  uuid, boolean, uuid, text, uuid
) to authenticated;

revoke all on function public.sync_subscription_email_usage_status() from public, anon, authenticated;
revoke all on function public.sync_inventory_email_usage_status() from public, anon, authenticated;
