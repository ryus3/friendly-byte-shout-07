-- إصلاح جدول region_aliases - إزالة city_id لأنه غير مطلوب
ALTER TABLE region_aliases DROP COLUMN IF EXISTS city_id;

-- إدراج بعض المرادفات الأساسية أولاً
INSERT INTO city_aliases (city_id, alias_name, normalized_name, confidence_score) 
SELECT 
  c.id,
  'ديوانية',
  'ديوانيه',
  1.0
FROM cities_cache c 
WHERE c.name = 'الديوانية'
AND NOT EXISTS (
  SELECT 1 FROM city_aliases ca 
  WHERE ca.city_id = c.id AND ca.alias_name = 'ديوانية'
);

-- إضافة مرادفات أساسية أخرى
INSERT INTO city_aliases (city_id, alias_name, normalized_name, confidence_score) 
SELECT 
  c.id,
  alias_data.alias,
  alias_data.normalized,
  alias_data.confidence
FROM (
  VALUES 
    ('بغداد', 'العاصمة', 'العاصمه', 0.9),
    ('كربلاء', 'كرب', 'كرب', 0.7),
    ('النجف', 'نجف', 'نجف', 1.0),
    ('البصرة', 'بصرة', 'بصره', 1.0),
    ('العمارة', 'عمارة', 'عماره', 1.0),
    ('الناصرية', 'ناصرية', 'ناصريه', 1.0),
    ('الكوت', 'كوت', 'كوت', 1.0),
    ('الحلة', 'حلة', 'حله', 1.0),
    ('الرمادي', 'رمادي', 'رمادي', 1.0),
    ('الموصل', 'موصل', 'موصل', 1.0),
    ('أربيل', 'اربيل', 'اربيل', 1.0),
    ('السليمانية', 'سليمانية', 'سليمانيه', 1.0),
    ('سامراء', 'سامرة', 'سامره', 0.9),
    ('الفلوجة', 'فلوجة', 'فلوجه', 1.0)
) AS alias_data(city_name, alias, normalized, confidence)
INNER JOIN cities_cache c ON c.name = alias_data.city_name
WHERE NOT EXISTS (
  SELECT 1 FROM city_aliases ca 
  WHERE ca.city_id = c.id AND ca.alias_name = alias_data.alias
);