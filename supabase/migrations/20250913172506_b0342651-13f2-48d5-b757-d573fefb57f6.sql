-- إصلاح دالة handle_new_user لتعمل مع النظام الحالي للأدوار
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE
  user_count INTEGER;
  user_status TEXT;
  admin_role_id UUID;
  employee_role_id UUID;
BEGIN
  -- Check if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Set status based on user count
  IF user_count = 0 THEN
    user_status := 'active';  -- First user is admin and active
  ELSE
    user_status := 'pending'; -- Other users need approval
  END IF;
  
  -- Insert new profile (without role column)
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    username, 
    email, 
    status
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'username', ''),
    NEW.email,
    user_status
  );
  
  -- If this is the first user, assign admin role
  IF user_count = 0 THEN
    -- Get admin role ID
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;
    
    -- If admin role exists, assign it
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, is_active)
      VALUES (NEW.id, admin_role_id, true);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;