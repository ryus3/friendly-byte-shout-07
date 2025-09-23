-- حذف السجل المكرر من جدول telegram_employee_codes للموظف أحمد
DELETE FROM public.telegram_employee_codes 
WHERE telegram_chat_id = 1998984107 
AND employee_code = 'AHM435';