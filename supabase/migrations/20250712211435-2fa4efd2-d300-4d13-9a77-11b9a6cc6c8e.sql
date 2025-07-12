-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS default_page TEXT;

-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates if not exists
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to check if username exists (case-insensitive)
CREATE OR REPLACE FUNCTION public.username_exists(p_username TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(p_username)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user by username (case-insensitive)
CREATE OR REPLACE FUNCTION public.get_user_by_username(username_input TEXT)
RETURNS TABLE(email TEXT, user_id UUID) AS $$
BEGIN
  RETURN QUERY 
  SELECT p.email, p.user_id
  FROM public.profiles p
  WHERE LOWER(p.username) = LOWER(username_input)
  AND p.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;