-- تنشيط حساب المدير العام
UPDATE profiles 
SET is_active = true, status = 'active', updated_at = now()
WHERE username = 'ryus';