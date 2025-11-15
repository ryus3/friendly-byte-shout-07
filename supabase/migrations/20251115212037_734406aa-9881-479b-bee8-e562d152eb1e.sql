-- ✅ تعطيل جميع التوكنات المنتهية الصلاحية
UPDATE delivery_partner_tokens
SET 
  is_active = false,
  updated_at = NOW()
WHERE 
  expires_at < NOW()
  AND is_active = true;

-- ✅ عرض عدد التوكنات المعطلة
DO $$
DECLARE
  deactivated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deactivated_count
  FROM delivery_partner_tokens
  WHERE expires_at < NOW() AND is_active = false;
  
  RAISE NOTICE '✅ تم تعطيل التوكنات المنتهية الصلاحية. العدد الإجمالي: %', deactivated_count;
END $$;