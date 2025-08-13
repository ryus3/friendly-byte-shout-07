-- Create table to ensure idempotency for Telegram updates
create table if not exists public.telegram_processed_updates (
  update_id bigint primary key,
  chat_id bigint not null,
  message_id bigint not null,
  processed_at timestamptz not null default now()
);

-- Ensure unique per chat/message as an additional safeguard
create unique index if not exists uq_telegram_chat_message on public.telegram_processed_updates(chat_id, message_id);

-- Enable RLS and restrict access to service role only (edge functions use service key and bypass RLS)
alter table public.telegram_processed_updates enable row level security;

-- Optional: deny all to regular clients; service_role bypasses RLS, so no policy is required for it
-- (We intentionally do not add permissive policies for anon/authenticated roles)
