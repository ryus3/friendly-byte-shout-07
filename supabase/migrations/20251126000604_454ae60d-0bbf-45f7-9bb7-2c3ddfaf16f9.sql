-- ✅ تفعيل جميع التوكنات الصالحة (غير المنتهية)
-- هذا يصلح التوكنات الحالية التي is_active = false لكن expires_at لا زالت صالحة

UPDATE delivery_partner_tokens
SET 
  is_active = true,
  updated_at = now()
WHERE 
  expires_at > now()
  AND is_active = false;

-- إضافة تعليق توثيقي
COMMENT ON COLUMN delivery_partner_tokens.is_active IS 
'يجب أن يكون true للتوكنات الصالحة. يتم تحديثه تلقائياً عند تسجيل الدخول.';