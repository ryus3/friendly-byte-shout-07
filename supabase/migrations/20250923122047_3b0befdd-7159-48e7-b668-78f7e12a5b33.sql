-- إصلاح telegram_chat_id لجعله bigint صحيح بدلاً من scientific notation
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = 499943724 
WHERE employee_code = 'RYU559' AND telegram_chat_id::text LIKE '%e+%';

-- التأكد من أن النوع صحيح
ALTER TABLE public.telegram_employee_codes 
ALTER COLUMN telegram_chat_id TYPE bigint;