-- تحديث دالة إنشاء رموز فريدة تحتوي على أحرف وأرقام (8 خانات)
CREATE OR REPLACE FUNCTION public.generate_telegram_code(user_id_input UUID, username_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_employee_code TEXT;
  code_exists BOOLEAN;
  characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INTEGER;
BEGIN
  -- إنشاء رمز عشوائي مكون من 8 أحرف وأرقام
  LOOP
    new_employee_code := '';
    
    -- إنشاء رمز من 8 خانات (أحرف وأرقام)
    FOR i IN 1..8 LOOP
      new_employee_code := new_employee_code || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
    END LOOP;
    
    -- التحقق من عدم وجود الرمز مسبقاً
    SELECT EXISTS(
      SELECT 1 FROM public.telegram_employee_codes 
      WHERE employee_code = new_employee_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- إدخال الرمز في الجدول أو تحديثه
  INSERT INTO public.telegram_employee_codes (user_id, employee_code)
  VALUES (user_id_input, new_employee_code)
  ON CONFLICT (user_id) DO UPDATE SET 
    employee_code = EXCLUDED.employee_code,
    updated_at = now();
  
  RETURN new_employee_code;
END;
$$;

-- تحديث الرموز الموجودة مع الجديدة
UPDATE public.telegram_employee_codes 
SET employee_code = public.generate_telegram_code(user_id, ''), 
    updated_at = now();

-- إنشاء رموز للمستخدمين الجدد الذين لا يملكون رموز
INSERT INTO public.telegram_employee_codes (user_id, employee_code)
SELECT 
  p.user_id,
  public.generate_telegram_code(p.user_id, p.username)
FROM public.profiles p
WHERE p.is_active = true 
  AND NOT EXISTS (
    SELECT 1 FROM public.telegram_employee_codes tec 
    WHERE tec.user_id = p.user_id
  );