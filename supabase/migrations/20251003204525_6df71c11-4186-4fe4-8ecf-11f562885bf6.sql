-- حذف جميع مرادفات المدن (225 مرادف)
DELETE FROM city_aliases;

-- حذف مرادفات المناطق الفاسدة التي تشير إلى مناطق غير موجودة
DELETE FROM region_aliases ra 
WHERE NOT EXISTS (
  SELECT 1 FROM regions_cache rc WHERE rc.id = ra.region_id
);