-- حل الازدواجية: حذف السجل الخطأ (647) والإبقاء على الصحيح (2718)

-- التحقق من الوضع الحالي
DO $$
BEGIN
  RAISE NOTICE '=== الوضع قبل التصحيح ===';
  RAISE NOTICE 'سجلات "الدوره كفاءات الصحه":';
END $$;

SELECT region_id, external_id, external_name, created_at
FROM region_delivery_mappings
WHERE external_id = '647' AND delivery_partner = 'alwaseet';

-- حذف السجل الخطأ
DELETE FROM region_delivery_mappings
WHERE external_id = '647' 
  AND delivery_partner = 'alwaseet'
  AND region_id = 647;  -- فقط الخطأ، ليس 2718

-- التحقق من النتيجة النهائية
DO $$
DECLARE
  v_remaining_count integer;
  v_final_region_id integer;
BEGIN
  SELECT COUNT(*), MAX(region_id) 
  INTO v_remaining_count, v_final_region_id
  FROM region_delivery_mappings
  WHERE external_id = '647' AND delivery_partner = 'alwaseet';
  
  IF v_remaining_count = 1 AND v_final_region_id = 2718 THEN
    RAISE NOTICE '✓ تم الإصلاح بنجاح - السجل الصحيح فقط متبقي (region_id: 2718)';
  ELSIF v_remaining_count = 0 THEN
    RAISE NOTICE '⚠️ تحذير: لا يوجد سجل متبقي - قد نحتاج إعادة إنشاء السجل الصحيح';
  ELSE
    RAISE NOTICE '⚠️ لا يزال هناك % سجل', v_remaining_count;
  END IF;
END $$;