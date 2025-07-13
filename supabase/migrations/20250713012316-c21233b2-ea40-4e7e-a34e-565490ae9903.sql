-- نقل البيانات المختلطة إلى الجداول الصحيحة
-- نقل أنواع المنتجات من categories إلى product_types
INSERT INTO product_types (name, description)
SELECT name, description 
FROM categories 
WHERE type = 'product_type'
ON CONFLICT (name) DO NOTHING;

-- نقل المواسم/المناسبات من categories إلى seasons_occasions
INSERT INTO seasons_occasions (name, type, description)
SELECT 
    name,
    CASE 
        WHEN name IN ('شتوي', 'صيفي') THEN 'season'
        ELSE 'occasion'
    END as type,
    description
FROM categories 
WHERE type = 'season_occasion'
ON CONFLICT (name) DO NOTHING;

-- حذف البيانات المختلطة من categories وإبقاء التصنيفات الرئيسية فقط
DELETE FROM categories WHERE type != 'main_category';