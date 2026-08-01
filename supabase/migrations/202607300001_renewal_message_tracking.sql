alter table public.subscriptions
  add column if not exists renewal_message_sent_at timestamptz;
