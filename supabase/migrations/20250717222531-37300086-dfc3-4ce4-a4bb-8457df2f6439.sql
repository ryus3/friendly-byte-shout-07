-- تنظيف الأدوار المكررة
WITH duplicates AS (
  SELECT user_id, role_id, 
         ROW_NUMBER() OVER (PARTITION BY user_id, role_id ORDER BY assigned_at ASC) as rn
  FROM user_roles
)
DELETE FROM user_roles 
WHERE id IN (
  SELECT ur.id 
  FROM user_roles ur
  JOIN duplicates d ON ur.user_id = d.user_id AND ur.role_id = d.role_id
  WHERE d.rn > 1
);

-- التأكد من وجود رمز تليغرام للمدير
INSERT INTO employee_telegram_codes (user_id, telegram_code)
SELECT '91484496-b887-44f7-9e5d-be9db5567604', 'MAN' || RIGHT(REPLACE('91484496-b887-44f7-9e5d-be9db5567604'::text, '-', ''), 4)
WHERE NOT EXISTS (
  SELECT 1 FROM employee_telegram_codes 
  WHERE user_id = '91484496-b887-44f7-9e5d-be9db5567604'
);

-- إنشاء فهرس فريد للأدوار لمنع التكرار مستقبلاً
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_role 
ON user_roles (user_id, role_id) 
WHERE is_active = true;