-- إنشاء رمز تليغرام لجميع المستخدمين النشطين
INSERT INTO employee_telegram_codes (user_id, telegram_code)
SELECT 
  user_id,
  UPPER(LEFT(COALESCE(full_name, username), 3)) || RIGHT(REPLACE(user_id::text, '-', ''), 4)
FROM profiles 
WHERE status = 'active' 
  AND user_id NOT IN (
    SELECT user_id FROM employee_telegram_codes WHERE user_id IS NOT NULL
  );