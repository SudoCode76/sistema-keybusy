alter table public.spotify_member_accounts
  add column if not exists member_name text;

update public.spotify_member_accounts
set member_name = nullif(btrim(member_name), '')
where member_name is not null;
