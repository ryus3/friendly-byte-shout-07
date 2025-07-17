-- التأكد من أن حساب المدير نشط ومُفعل
UPDATE profiles 
SET is_active = true, status = 'active', updated_at = now()
WHERE username = 'ryus';