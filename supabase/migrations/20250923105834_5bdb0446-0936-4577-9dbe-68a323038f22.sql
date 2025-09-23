-- Properly fix the chat_id issue by converting the scientific notation
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = 499943724::bigint
WHERE employee_code = 'RYU559' 
  AND telegram_chat_id::text LIKE '%e+%';

-- Verify the fix worked
SELECT employee_code, telegram_chat_id, user_id 
FROM telegram_employee_codes 
WHERE employee_code = 'RYU559';