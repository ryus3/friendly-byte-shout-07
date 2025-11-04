-- إنشاء دالة للتحقق من وجود البريد الإلكتروني في auth.users
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- التحقق من وجود البريد في auth.users
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = p_email
    AND deleted_at IS NULL
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

-- منح صلاحيات للمستخدمين المصادق عليهم والمجهولين
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated, anon;