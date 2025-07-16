-- إصلاح مشكلة Function Search Path لتحسين الأمان
-- إعادة إنشاء الـ function مع search_path آمن

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public'
AS $$
DECLARE
  user_count INTEGER;
  user_role TEXT;
  user_status TEXT;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Set role and status based on user count
  IF user_count = 0 THEN
    user_role := 'admin';
    user_status := 'active';
  ELSE
    user_role := 'employee';
    user_status := 'pending';
  END IF;
  
  -- Insert new profile
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    username, 
    email, 
    role,
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'username', ''),
    NEW.email,
    user_role,
    user_status
  );
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();