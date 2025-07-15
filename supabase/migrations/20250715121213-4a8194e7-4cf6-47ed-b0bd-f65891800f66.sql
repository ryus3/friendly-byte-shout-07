-- إنشاء جدول رموز الموظفين للتليغرام
CREATE TABLE public.telegram_employee_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  telegram_chat_id BIGINT NULL,
  linked_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إنشاء فهرس للبحث السريع
CREATE INDEX idx_telegram_codes_employee_code ON public.telegram_employee_codes(employee_code);
CREATE INDEX idx_telegram_codes_user_id ON public.telegram_employee_codes(user_id);

-- تفعيل RLS
ALTER TABLE public.telegram_employee_codes ENABLE ROW LEVEL SECURITY;

-- إنشاء السياسات
CREATE POLICY "Authenticated users can view telegram codes" 
ON public.telegram_employee_codes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage telegram codes" 
ON public.telegram_employee_codes 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- دالة لإنشاء رمز تلقائيا عند إضافة موظف جديد
CREATE OR REPLACE FUNCTION public.generate_telegram_code(user_id_input UUID, username_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  INSERT INTO public.telegram_employee_codes (user_id, employee_code)
  VALUES (user_id_input, employee_code)
  ON CONFLICT (user_id) DO UPDATE SET 
    employee_code = EXCLUDED.employee_code,
    updated_at = now();
  
  RETURN employee_code;
END;
$$;

-- إنشاء رموز لجميع المستخدمين الحاليين
INSERT INTO public.telegram_employee_codes (user_id, employee_code)
SELECT 
  p.user_id,
  UPPER(LEFT(p.username, 3)) || RIGHT(REPLACE(p.user_id::TEXT, '-', ''), 4)
FROM public.profiles p
WHERE p.is_active = true
ON CONFLICT (user_id) DO NOTHING;