-- ✅ إصلاح delivery_account_used الفارغة - استخدام الحساب الافتراضي
-- المرحلة 1: تحديث طلبات الوسيط بدون delivery_account_used

UPDATE orders o
SET 
  delivery_account_used = (
    SELECT dpt.account_username
    FROM delivery_partner_tokens dpt
    WHERE dpt.partner_name = 'alwaseet'
      AND dpt.is_active = true
      AND dpt.user_id = o.created_by
      AND (dpt.is_default = true OR dpt.account_username IS NOT NULL)
    ORDER BY dpt.is_default DESC, dpt.last_used_at DESC
    LIMIT 1
  ),
  updated_at = NOW()
WHERE 
  o.delivery_partner = 'alwaseet'
  AND o.delivery_account_used IS NULL
  AND EXISTS (
    SELECT 1 FROM delivery_partner_tokens dpt
    WHERE dpt.partner_name = 'alwaseet'
      AND dpt.is_active = true
      AND dpt.user_id = o.created_by
  );

-- المرحلة 2: تحديث طلبات مدن بدون delivery_account_used

UPDATE orders o
SET 
  delivery_account_used = (
    SELECT dpt.account_username
    FROM delivery_partner_tokens dpt
    WHERE dpt.partner_name = 'modon'
      AND dpt.is_active = true
      AND dpt.user_id = o.created_by
      AND (dpt.is_default = true OR dpt.account_username IS NOT NULL)
    ORDER BY dpt.is_default DESC, dpt.last_used_at DESC
    LIMIT 1
  ),
  updated_at = NOW()
WHERE 
  o.delivery_partner = 'modon'
  AND o.delivery_account_used IS NULL
  AND EXISTS (
    SELECT 1 FROM delivery_partner_tokens dpt
    WHERE dpt.partner_name = 'modon'
      AND dpt.is_active = true
      AND dpt.user_id = o.created_by
  );