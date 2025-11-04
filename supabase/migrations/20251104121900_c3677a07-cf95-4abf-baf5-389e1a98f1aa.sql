-- إصلاح نظام employee_code باستخدام SEQUENCE

-- 1. إنشاء sequence للتحكم في الأرقام بشكل atomic وآمن
CREATE SEQUENCE IF NOT EXISTS employee_code_seq;

-- 2. تحديد قيمة البداية للـ sequence بناءً على أعلى رقم موجود
SELECT setval('employee_code_seq', 
  COALESCE(
    (SELECT MAX(
      CASE 
        WHEN employee_code ~ '^EMP[0-9]+$' 
        THEN CAST(SUBSTRING(employee_code FROM 4) AS INTEGER)
        ELSE 0
      END
    ) FROM profiles WHERE employee_code IS NOT NULL), 
    0
  ) + 1,
  false
);

-- 3. تصحيح employee_code لعبدالله من EMP0001 إلى EMP004
UPDATE profiles 
SET employee_code = 'EMP004'
WHERE employee_code = 'EMP0001';

-- 4. تحديث دالة generate_employee_code لاستخدام SEQUENCE (thread-safe)
CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
  code_exists BOOLEAN;
  max_attempts INTEGER := 100;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- الحصول على الرقم التالي من الـ sequence (atomic & thread-safe)
    next_number := nextval('employee_code_seq');
    
    -- تنسيق الكود: EMP + رقم بـ 3 خانات على الأقل (EMP001, EMP002, ...)
    new_code := 'EMP' || LPAD(next_number::TEXT, 3, '0');
    
    -- التحقق من عدم وجود الكود (احتياط إضافي)
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE employee_code = new_code
    ) INTO code_exists;
    
    -- الخروج إذا كان الكود جديداً
    EXIT WHEN NOT code_exists;
    
    -- حماية من infinite loop
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique employee code after % attempts', max_attempts;
    END IF;
  END LOOP;
  
  RETURN new_code;
END;
$$;