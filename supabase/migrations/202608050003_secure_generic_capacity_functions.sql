revoke all on function public.create_platform_with_product(
  text, text, text, text, text, text, text, integer, text[], integer,
  numeric, public.currency_code, numeric, numeric, public.currency_code, numeric
) from public, anon;

grant execute on function public.create_platform_with_product(
  text, text, text, text, text, text, text, integer, text[], integer,
  numeric, public.currency_code, numeric, numeric, public.currency_code, numeric
) to authenticated;

revoke all on function public.enforce_service_product_mode() from public, anon, authenticated;
revoke all on function public.enforce_subscription_account_capacity() from public, anon, authenticated;
