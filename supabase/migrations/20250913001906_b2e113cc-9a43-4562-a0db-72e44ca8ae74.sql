-- Create table for tracking processed Telegram updates to prevent duplicates
CREATE TABLE public.telegram_processed_updates (
  update_id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  message_hash TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(chat_id, message_id)
);

-- Enable RLS
ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;

-- Create policies to deny all access (this table is only for edge functions)
CREATE POLICY "deny all deletes" ON public.telegram_processed_updates 
FOR DELETE USING (false);

CREATE POLICY "deny all inserts" ON public.telegram_processed_updates 
FOR INSERT WITH CHECK (false);

CREATE POLICY "deny all selects" ON public.telegram_processed_updates 
FOR SELECT USING (false);

CREATE POLICY "deny all updates" ON public.telegram_processed_updates 
FOR UPDATE USING (false) WITH CHECK (false);