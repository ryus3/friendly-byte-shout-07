-- Secure profiles table: restrict public reading and keep admins full access
-- 1) Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2) Drop overly permissive public SELECT policy if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can view all profiles'
  ) THEN
    DROP POLICY "Users can view all profiles" ON public.profiles;
  END IF;
END $$;

-- 3) Add restrictive SELECT policy (only owner or admins/deputies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Users can view own or admins view all'
  ) THEN
    CREATE POLICY "Users can view own or admins view all"
    ON public.profiles
    FOR SELECT
    USING ((auth.uid() = user_id) OR is_admin_or_deputy());
  END IF;
END $$;

-- Note: Existing policy "Safe admin access to profiles" (ALL) stays, ensuring admins/deputies retain full access without breaking features like employee management.