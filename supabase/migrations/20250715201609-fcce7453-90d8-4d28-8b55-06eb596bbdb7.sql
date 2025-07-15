-- إصلاح دالة المصادقة باسم المستخدم
CREATE OR REPLACE FUNCTION public.auth_with_username(username_input text, password_input text)
RETURNS TABLE(success boolean, user_email text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_email_found TEXT;
BEGIN
  -- البحث عن البريد الإلكتروني المرتبط باسم المستخدم
  SELECT email INTO user_email_found 
  FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_input) 
  AND is_active = true 
  AND status = 'active';
  
  -- إذا لم يوجد المستخدم
  IF user_email_found IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, 'اسم المستخدم غير صحيح أو غير موجود'::TEXT;
    RETURN;
  END IF;
  
  -- إرجاع النتيجة الإيجابية مع البريد الإلكتروني
  RETURN QUERY SELECT true, user_email_found, ''::TEXT;
END;
$function$