-- Secure customers table: protect PII with proper RLS without breaking workflows (fixed)

-- 1) Enable RLS if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'customers'
  ) THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Table public.customers does not exist; skipping RLS changes.';
  END IF;
END $$;

-- 2) Recreate policies safely
DO $$
DECLARE
  has_created_by boolean;
  pol RECORD;
BEGIN
  -- Exit early if table missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'customers'
  ) THEN
    RETURN;
  END IF;

  -- Detect created_by column presence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'created_by'
  ) INTO has_created_by;

  -- Drop existing policies
  FOR pol IN 
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', pol.policyname);
  END LOOP;

  IF has_created_by THEN
    -- SELECT policy
    CREATE POLICY "Customers: select own or admins"
    ON public.customers
    FOR SELECT
    TO authenticated
    USING (
      (created_by = auth.uid()) OR 
      is_admin_or_deputy() OR 
      check_user_permission(auth.uid(), 'manage_all_customers')
    );

    -- INSERT policy
    CREATE POLICY "Customers: insert own"
    ON public.customers
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

    -- UPDATE policy
    CREATE POLICY "Customers: update own or admins"
    ON public.customers
    FOR UPDATE
    TO authenticated
    USING (
      (created_by = auth.uid()) OR 
      is_admin_or_deputy() OR 
      check_user_permission(auth.uid(), 'manage_all_customers')
    )
    WITH CHECK (
      (created_by = auth.uid()) OR 
      is_admin_or_deputy() OR 
      check_user_permission(auth.uid(), 'manage_all_customers')
    );

    -- DELETE policy
    CREATE POLICY "Customers: delete own or admins"
    ON public.customers
    FOR DELETE
    TO authenticated
    USING (
      (created_by = auth.uid()) OR 
      is_admin_or_deputy() OR 
      check_user_permission(auth.uid(), 'manage_all_customers')
    );
  ELSE
    -- Fallback strict policy if created_by missing
    CREATE POLICY "Customers: admins/deputies only (fallback)"
    ON public.customers
    FOR ALL
    TO authenticated
    USING (is_admin_or_deputy() OR check_user_permission(auth.uid(), 'manage_all_customers'))
    WITH CHECK (is_admin_or_deputy() OR check_user_permission(auth.uid(), 'manage_all_customers'));
  END IF;
END $$;