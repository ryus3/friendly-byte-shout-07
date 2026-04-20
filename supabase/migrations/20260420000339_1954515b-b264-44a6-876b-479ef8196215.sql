DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'employee_profit_rules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_profit_rules;
  END IF;
END $$;

ALTER TABLE public.employee_profit_rules REPLICA IDENTITY FULL;