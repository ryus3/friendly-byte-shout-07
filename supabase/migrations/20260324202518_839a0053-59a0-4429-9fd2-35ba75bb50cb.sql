DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cash_sources' AND column_name = 'initial_capital') THEN
    ALTER TABLE public.cash_sources ADD COLUMN initial_capital NUMERIC DEFAULT 0;
  END IF;
END $$;