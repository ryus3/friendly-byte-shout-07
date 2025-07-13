-- نقل البيانات المختلطة إلى الجداول الصحيحة
-- نقل أنواع المنتجات من categories إلى product_types (تجاهل المكررات)
INSERT INTO product_types (name, description)
SELECT name, description 
FROM categories 
WHERE type = 'product_type'
AND name NOT IN (SELECT name FROM product_types);

-- نقل المواسم/المناسبات من categories إلى seasons_occasions (تجاهل المكررات)
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
AND name NOT IN (SELECT name FROM seasons_occasions);

-- حذف البيانات المختلطة من categories وإبقاء التصنيفات الرئيسية فقط
DELETE FROM categories WHERE type != 'main_category';