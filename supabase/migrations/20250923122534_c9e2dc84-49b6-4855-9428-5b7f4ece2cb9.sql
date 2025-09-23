-- Final fix for telegram_chat_id - ensure it's exactly 499943724 as bigint
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = 499943724 
WHERE employee_code = 'RYU559';

-- Verify the fix
SELECT employee_code, telegram_chat_id, is_active 
FROM telegram_employee_codes 
WHERE employee_code = 'RYU559';