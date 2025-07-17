-- تحديث جدول رموز التليغرام بالأكواد الجديدة
UPDATE employee_telegram_codes 
SET 
  telegram_code = (
    SELECT public.generate_employee_telegram_code(employee_telegram_codes.user_id)
  ),
  updated_at = now()
WHERE user_id IN (
  SELECT user_id FROM profiles WHERE status = 'active'
);