-- Robust REPLICA IDENTITY + Realtime publication setup for critical realtime tables
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN 
    SELECT unnest(ARRAY['orders','ai_orders','notifications']) AS table_name
  LOOP
    -- If table exists, enforce FULL replica identity
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = t.table_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t.table_name);

      -- Add table to supabase_realtime publication if not already present
      IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = t.table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t.table_name);
      END IF;
    END IF;
  END LOOP;
END $$;