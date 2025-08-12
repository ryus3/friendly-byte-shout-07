-- Secure business-sensitive tables: products, roles, permissions, loyalty_tiers
-- Goal: remove public read access and require authentication, without breaking writes

-- Helper to check table existence
CREATE OR REPLACE FUNCTION public._table_exists(schema_name text, table_name text)
RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = schema_name AND table_name = table_name
  );
$$;

-- PRODUCTS: restrict reads to authenticated users
DO $$
DECLARE pol RECORD; BEGIN
  IF public._table_exists('public','products') THEN
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    -- Drop all SELECT policies to remove any public-read
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='products' AND cmd='SELECT' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', pol.policyname);
    END LOOP;
    -- Add authenticated-only SELECT
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='Authenticated users can view products'
    ) THEN
      CREATE POLICY "Authenticated users can view products"
      ON public.products
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
    END IF;
  ELSE
    RAISE NOTICE 'Table public.products not found; skipping';
  END IF;
END $$;

-- ROLES: drop public SELECT and require auth
DO $$
BEGIN
  IF public._table_exists('public','roles') THEN
    ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
    -- Drop the public SELECT policy if present
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='roles' AND policyname = 'الجميع يرى الأدوار النشطة'
    ) THEN
      DROP POLICY "الجميع يرى الأدوار النشطة" ON public.roles;
    END IF;
    -- Ensure authenticated SELECT of active roles (admins already have ALL via existing policy)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='roles' AND policyname='Roles: view active (authenticated)'
    ) THEN
      CREATE POLICY "Roles: view active (authenticated)"
      ON public.roles
      FOR SELECT TO authenticated
      USING (is_active = true);
    END IF;
  ELSE
    RAISE NOTICE 'Table public.roles not found; skipping';
  END IF;
END $$;

-- PERMISSIONS: drop public SELECT and keep least privilege
DO $$
BEGIN
  IF public._table_exists('public','permissions') THEN
    ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
    -- Drop public-read policy if present
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='permissions' AND policyname = 'الجميع يرى الصلاحيات النشطة'
    ) THEN
      DROP POLICY "الجميع يرى الصلاحيات النشطة" ON public.permissions;
    END IF;
    -- Optionally ensure admins can view all (admins already have ALL via existing policy). No extra policy needed.
  ELSE
    RAISE NOTICE 'Table public.permissions not found; skipping';
  END IF;
END $$;

-- LOYALTY TIERS: restrict reads to authenticated users
DO $$
DECLARE pol RECORD; BEGIN
  IF public._table_exists('public','loyalty_tiers') THEN
    ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND cmd='SELECT' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.loyalty_tiers', pol.policyname);
    END LOOP;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_tiers' AND policyname='Authenticated users can view loyalty_tiers'
    ) THEN
      CREATE POLICY "Authenticated users can view loyalty_tiers"
      ON public.loyalty_tiers
      FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
    END IF;
  ELSE
    RAISE NOTICE 'Table public.loyalty_tiers not found; skipping';
  END IF;
END $$;

-- Clean up helper function (optional)
DROP FUNCTION IF EXISTS public._table_exists(text, text);