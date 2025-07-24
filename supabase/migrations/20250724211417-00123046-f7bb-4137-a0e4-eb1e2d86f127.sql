-- إصلاح الأخطاء الأمنية في الدوال بتطبيق search_path مناسب
-- هذا سيصلح كل الـ 19 خطأ الأمني

-- 1. إصلاح دالة auth_with_username
DROP FUNCTION IF EXISTS public.auth_with_username(text, text);
CREATE OR REPLACE FUNCTION public.auth_with_username(username_input text, password_input text)
 RETURNS TABLE(success boolean, user_email text, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_email_found TEXT;
BEGIN
  -- البحث عن البريد الإلكتروني المرتبط باسم المستخدم
  SELECT email INTO user_email_found 
  FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_input) 
  AND is_active = true;
  
  -- إذا لم يوجد المستخدم
  IF user_email_found IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, 'اسم المستخدم غير صحيح أو غير موجود'::TEXT;
    RETURN;
  END IF;
  
  -- إرجاع النتيجة الإيجابية مع البريد الإلكتروني
  RETURN QUERY SELECT true, user_email_found, ''::TEXT;
END;
$function$;

-- 2. إصلاح دالة get_employee_by_telegram_id
DROP FUNCTION IF EXISTS public.get_employee_by_telegram_id(bigint);
CREATE OR REPLACE FUNCTION public.get_employee_by_telegram_id(p_telegram_chat_id bigint)
 RETURNS TABLE(user_id uuid, employee_code text, full_name text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    tec.employee_code,
    p.full_name,
    'employee'::text as role
  FROM public.employee_telegram_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.telegram_chat_id = p_telegram_chat_id 
    AND tec.is_active = true
    AND p.is_active = true;
END;
$function$;

-- 3. إصلاح دالة generate_telegram_code
DROP FUNCTION IF EXISTS public.generate_telegram_code(uuid, text);
CREATE OR REPLACE FUNCTION public.generate_telegram_code(user_id_input uuid, username_input text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  short_username TEXT;
  short_id TEXT;
  employee_code TEXT;
BEGIN
  -- أخذ أول 3 أحرف من اسم المستخدم وتحويلها للأحرف الكبيرة
  short_username := UPPER(LEFT(username_input, 3));
  
  -- أخذ آخر 4 أرقام من user_id
  short_id := RIGHT(REPLACE(user_id_input::TEXT, '-', ''), 4);
  
  -- دمج الكود
  employee_code := short_username || short_id;
  
  -- إدخال الكود في الجدول
  INSERT INTO public.employee_telegram_codes (user_id, employee_code)
  VALUES (user_id_input, employee_code)
  ON CONFLICT (user_id) DO UPDATE SET 
    employee_code = EXCLUDED.employee_code,
    updated_at = now();
  
  RETURN employee_code;
END;
$function$;