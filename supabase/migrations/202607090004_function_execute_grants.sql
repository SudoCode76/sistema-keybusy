revoke execute on function public.claim_first_admin() from public;
grant execute on function public.claim_first_admin() to authenticated;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_customer_owner(uuid) from public;
