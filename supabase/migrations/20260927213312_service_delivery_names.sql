alter table public.services
  add column if not exists delivery_name text;

update public.services
set delivery_name = case slug
  when 'spotify' then 'Spotify Premium'
  when 'chatgpt-shared' then 'ChatGPT Plus'
  when 'chatgpt-private' then 'ChatGPT Plus'
  when 'canva' then 'Canva Pro'
  when 'gemini-pro' then 'Gemini Pro'
  else name
end
where delivery_name is null;
