-- Final fix for RYU559 telegram_chat_id using most explicit casting
ALTER TABLE employee_telegram_codes ALTER COLUMN telegram_chat_id TYPE bigint;

UPDATE employee_telegram_codes 
SET telegram_chat_id = CAST(499943724 AS bigint)
WHERE telegram_code = 'RYU559';

-- Test the RPC function
SELECT public.find_employee_by_telegram_chat_id(499943724);