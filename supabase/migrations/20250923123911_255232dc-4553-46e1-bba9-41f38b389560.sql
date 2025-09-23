-- STAGE 1: Force fix telegram_chat_id to proper bigint
UPDATE telegram_employee_codes 
SET telegram_chat_id = 499943724::bigint 
WHERE employee_code = 'RYU559';

-- Verify the fix worked
SELECT employee_code, telegram_chat_id, pg_typeof(telegram_chat_id) as data_type 
FROM telegram_employee_codes 
WHERE employee_code = 'RYU559';