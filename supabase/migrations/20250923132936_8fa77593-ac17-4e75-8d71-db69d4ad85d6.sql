-- إصلاح نهائي لـ telegram_chat_id لـ RYU559
UPDATE employee_telegram_codes 
SET telegram_chat_id = 499943724::bigint
WHERE telegram_code = 'RYU559' AND telegram_chat_id != 499943724;