
-- ═══════════════════════════════════════════════════════════
-- الحل الكامل: بناء نظام موحد للمعرفات من regions_master
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ إنشاء دالة موحدة للحصول على المعرف الخارجي
CREATE OR REPLACE FUNCTION get_region_external_id(
  p_region_id integer,
  p_delivery_partner text DEFAULT 'alwaseet'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- الأولوية لـ regions_master (المصدر الموحد)
  RETURN (
    SELECT alwaseet_id::text
    FROM regions_master
    WHERE id = p_region_id
    LIMIT 1
  );
END;
$$;

-- 2️⃣ إعادة بناء region_delivery_mappings من regions_master
TRUNCATE TABLE region_delivery_mappings CASCADE;

INSERT INTO region_delivery_mappings (
  region_id,       -- المعرف الموحد الداخلي (647)
  external_id,     -- المعرف الخارجي للوسيط ('647')
  external_name,   -- الاسم
  delivery_partner,
  is_active,
  created_at,
  updated_at
)
SELECT 
  id,                    -- المعرف الموحد من regions_master
  alwaseet_id::text,    -- المعرف الخارجي من regions_master
  name,
  'alwaseet',
  is_active,
  now(),
  now()
FROM regions_master
WHERE alwaseet_id IS NOT NULL;

-- 3️⃣ إعادة بناء city_delivery_mappings من cities_master
TRUNCATE TABLE city_delivery_mappings CASCADE;

INSERT INTO city_delivery_mappings (
  city_id,
  external_id,
  external_name,
  delivery_partner,
  is_active,
  created_at,
  updated_at
)
SELECT 
  id,
  alwaseet_id::text,
  name,
  'alwaseet',
  is_active,
  now(),
  now()
FROM cities_master
WHERE alwaseet_id IS NOT NULL;

-- 4️⃣ التحقق من النتيجة
DO $$
DECLARE
  v_regions_count integer;
  v_cities_count integer;
  v_test_region_id integer;
  v_test_external_id text;
BEGIN
  -- عدد المناطق المربوطة
  SELECT COUNT(*) INTO v_regions_count FROM region_delivery_mappings;
  SELECT COUNT(*) INTO v_cities_count FROM city_delivery_mappings;
  
  -- اختبار المنطقة 647
  SELECT region_id, external_id 
  INTO v_test_region_id, v_test_external_id
  FROM region_delivery_mappings
  WHERE external_id = '647'
  LIMIT 1;
  
  RAISE NOTICE '✅ تم إعادة بناء النظام الموحد بنجاح';
  RAISE NOTICE '📊 عدد المناطق المربوطة: %', v_regions_count;
  RAISE NOTICE '📊 عدد المدن المربوطة: %', v_cities_count;
  RAISE NOTICE '🔍 اختبار المنطقة 647:';
  RAISE NOTICE '   - region_id (موحد): %', v_test_region_id;
  RAISE NOTICE '   - external_id (وسيط): %', v_test_external_id;
  
  IF v_test_region_id IS NOT NULL THEN
    RAISE NOTICE '✓ المنطقة 647 مربوطة بشكل صحيح';
  ELSE
    RAISE NOTICE '⚠️ المنطقة 647 غير موجودة';
  END IF;
END $$;

-- 5️⃣ إنشاء index للأداء
CREATE INDEX IF NOT EXISTS idx_region_delivery_mappings_external_id 
ON region_delivery_mappings(external_id, delivery_partner);

CREATE INDEX IF NOT EXISTS idx_city_delivery_mappings_external_id 
ON city_delivery_mappings(external_id, delivery_partner);

-- 6️⃣ تعليق توضيحي
COMMENT ON FUNCTION get_region_external_id IS 
'دالة موحدة للحصول على المعرف الخارجي للمنطقة من regions_master (المصدر الموحد)';

COMMENT ON TABLE region_delivery_mappings IS 
'جدول ربط بين المعرفات الموحدة الداخلية والمعرفات الخارجية لشركات التوصيل - يتم بناؤه من regions_master';

COMMENT ON TABLE city_delivery_mappings IS 
'جدول ربط بين المعرفات الموحدة الداخلية والمعرفات الخارجية لشركات التوصيل - يتم بناؤه من cities_master';
