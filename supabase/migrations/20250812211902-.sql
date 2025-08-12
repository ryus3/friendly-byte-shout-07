-- Secure customers table: protect PII with proper RLS without breaking workflows

-- 1) Ensure table exists and enable RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'customers'
  ) THEN
    RAISE NOTICE 'Table public.customers does not exist; skipping RLS changes.';
  ELSE
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Helper: check if customers.created_by column exists
DO $$
DECLARE
  has_created_by boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'created_by'
  ) INTO has_created_by;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'customers'
  ) THEN
    RETURN;
  END IF;

  -- 2) Drop existing policies for a clean slate (idempotent)
  PERFORM 1;
  FOR policy_name IN (
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', policy_name);
  END LOOP;

  -- 3) Create secure policies
  IF has_created_by THEN
    -- SELECT: owner or admins/deputies or users with manage_all_customers permission
    CREATE POLICY "Customers: select own or admins"
    ON public.customers
    FOR SELECT
    TO authenticated
    USING (
      (created_by = auth.uid()) OR 
      is_admin_or_deputy() OR 
      check_user_permission(auth.uid(), 'manage_all_customers')
    );

    -- INSERT: only allow inserting rows for self (must set created_by = auth.uid())
    CREATE POLICY "Customers: insert own"
    ON public.customers
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

    -- UPDATE: owner or admins/deputies or users with permission
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

    -- DELETE: owner or admins/deputies or users with permission
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
    -- Fallback if created_by column is missing: restrict to admins/deputies only to avoid data leaks
    CREATE POLICY "Customers: admins/deputies only (fallback)"
    ON public.customers
    FOR ALL
    TO authenticated
    USING (is_admin_or_deputy() OR check_user_permission(auth.uid(), 'manage_all_customers'))
    WITH CHECK (is_admin_or_deputy() OR check_user_permission(auth.uid(), 'manage_all_customers'));
  END IF;
END $$;

-- Optional: ensure no public role bypass exists (RLS already enforces)
-- Note: Adjust app code to always set created_by = auth.uid() on inserts if not already.
