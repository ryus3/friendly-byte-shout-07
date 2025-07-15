-- تحديث دالة إنشاء رموز أكثر أماناً (8 خانات)
CREATE OR REPLACE FUNCTION public.generate_telegram_code(user_id_input UUID, username_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  employee_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- إنشاء رمز عشوائي مكون من 8 أرقام
  LOOP
    employee_code := LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    
    -- التحقق من عدم وجود الرمز مسبقاً
    SELECT EXISTS(
      SELECT 1 FROM public.telegram_employee_codes 
      WHERE employee_code = employee_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- إدخال الرمز في الجدول أو تحديثه
  INSERT INTO public.telegram_employee_codes (user_id, employee_code)
  VALUES (user_id_input, employee_code)
  ON CONFLICT (user_id) DO UPDATE SET 
    employee_code = EXCLUDED.employee_code,
    updated_at = now();
  
  RETURN employee_code;
END;
$$;

-- إنشاء رموز جديدة لجميع المستخدمين الحاليين بالنظام الجديد
DELETE FROM public.telegram_employee_codes;

INSERT INTO public.telegram_employee_codes (user_id, employee_code)
SELECT 
  p.user_id,
  public.generate_telegram_code(p.user_id, p.username)
FROM public.profiles p
WHERE p.is_active = true;

-- إنشاء trigger لإنشاء رمز تلقائياً عند إضافة موظف جديد
CREATE OR REPLACE FUNCTION public.create_telegram_code_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إنشاء رمز تليغرام للمستخدم الجديد
  PERFORM public.generate_telegram_code(NEW.user_id, NEW.username);
  RETURN NEW;
END;
$$;

-- حذف trigger القديم إن وجد وإنشاء جديد
DROP TRIGGER IF EXISTS create_telegram_code_trigger ON public.profiles;

CREATE TRIGGER create_telegram_code_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_telegram_code_for_new_user();