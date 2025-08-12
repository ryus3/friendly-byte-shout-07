-- Secure product_variants table: restrict public reading while preserving functionality

-- 1) Ensure RLS is enabled (idempotent and safe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'product_variants'
  ) THEN
    RAISE NOTICE 'Table public.product_variants does not exist; skipping RLS changes.';
  ELSE
    ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 2) Drop any existing SELECT policies to eliminate public-read holes
DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'product_variants'
  ) THEN
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'product_variants' 
        AND cmd = 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_variants', pol.policyname);
    END LOOP;
  END IF;
END $$;

-- 3) Create strict SELECT policy: only authenticated users can read variants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'product_variants'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'product_variants' 
        AND policyname = 'Authenticated users can view product_variants'
    ) THEN
      CREATE POLICY "Authenticated users can view product_variants"
      ON public.product_variants
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
    END IF;
  END IF;
END $$;

-- Note: We intentionally leave INSERT/UPDATE/DELETE policies untouched to avoid breaking existing write flows.
