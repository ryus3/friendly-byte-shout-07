-- إصلاح employee_code في جدول telegram_employee_codes ليطابق المعرف من جدول profiles
UPDATE public.telegram_employee_codes 
SET employee_code = p.employee_code,
    updated_at = now()
FROM public.profiles p 
WHERE telegram_employee_codes.user_id = p.user_id 
  AND telegram_employee_codes.employee_code != p.employee_code
  AND p.employee_code IS NOT NULL;