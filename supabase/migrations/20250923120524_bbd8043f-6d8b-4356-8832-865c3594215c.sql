-- Fix telegram_chat_id for RYU559 and any other affected employees
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = 499943724
WHERE employee_code = 'RYU559' AND telegram_chat_id IS NOT NULL;

-- Also fix any other employees with scientific notation issues
UPDATE public.telegram_employee_codes 
SET telegram_chat_id = CASE 
  WHEN telegram_chat_id = 4.99943724e8 THEN 499943724
  ELSE telegram_chat_id
END
WHERE telegram_chat_id IS NOT NULL;