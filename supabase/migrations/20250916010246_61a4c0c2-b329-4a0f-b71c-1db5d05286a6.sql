-- إصلاح رمز عبدالله ليكون صحيح (ABD + 4 أحرف إنجليزية)
UPDATE public.telegram_employee_codes 
SET employee_code = 'ABD' || SUBSTRING(UPPER(MD5(RANDOM()::text)), 1, 4),
    updated_at = now()
WHERE employee_code = 'عبد0b80' 
   OR employee_code LIKE '%عبد%';