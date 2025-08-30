-- إصلاح تصنيفات منتج برشلونة المفقودة
-- أولاً نجد معرف المنتج
DO $$
DECLARE
    barcelona_product_id uuid;
    category_id_male uuid;
    category_id_clothing uuid;
    category_id_summer uuid;
    category_id_track uuid;
    product_type_id_clothing uuid;
    department_id_men uuid;
BEGIN
    -- البحث عن منتج برشلونة
    SELECT id INTO barcelona_product_id 
    FROM products 
    WHERE LOWER(name) LIKE '%برشلونة%' OR LOWER(name) LIKE '%barcelona%'
    LIMIT 1;
    
    IF barcelona_product_id IS NULL THEN
        RAISE NOTICE 'لم يتم العثور على منتج برشلونة';
        RETURN;
    END IF;
    
    RAISE NOTICE 'تم العثور على منتج برشلونة: %', barcelona_product_id;
    
    -- البحث عن التصنيفات المطلوبة أو إنشاؤها
    
    -- تصنيف رجالي
    SELECT id INTO category_id_male FROM categories WHERE LOWER(name) = 'رجالي' LIMIT 1;
    IF category_id_male IS NULL THEN
        INSERT INTO categories (name, type) VALUES ('رجالي', 'main') RETURNING id INTO category_id_male;
    END IF;
    
    -- تصنيف ملابس
    SELECT id INTO category_id_clothing FROM categories WHERE LOWER(name) = 'ملابس' LIMIT 1;
    IF category_id_clothing IS NULL THEN
        INSERT INTO categories (name, type) VALUES ('ملابس', 'main') RETURNING id INTO category_id_clothing;
    END IF;
    
    -- تصنيف صيفي
    SELECT id INTO category_id_summer FROM categories WHERE LOWER(name) = 'صيفي' LIMIT 1;
    IF category_id_summer IS NULL THEN
        INSERT INTO categories (name, type) VALUES ('صيفي', 'main') RETURNING id INTO category_id_summer;
    END IF;
    
    -- تصنيف تراك
    SELECT id INTO category_id_track FROM categories WHERE LOWER(name) = 'تراك' LIMIT 1;
    IF category_id_track IS NULL THEN
        INSERT INTO categories (name, type) VALUES ('تراك', 'main') RETURNING id INTO category_id_track;
    END IF;
    
    -- إدراج التصنيفات للمنتج (مع تجاهل المكررات)
    INSERT INTO product_categories (product_id, category_id)
    VALUES 
        (barcelona_product_id, category_id_male),
        (barcelona_product_id, category_id_clothing),
        (barcelona_product_id, category_id_summer),
        (barcelona_product_id, category_id_track)
    ON CONFLICT DO NOTHING;
    
    -- البحث عن نوع المنتج أو إنشاؤه
    SELECT id INTO product_type_id_clothing FROM product_types WHERE LOWER(name) = 'ملابس' LIMIT 1;
    IF product_type_id_clothing IS NULL THEN
        INSERT INTO product_types (name) VALUES ('ملابس') RETURNING id INTO product_type_id_clothing;
    END IF;
    
    -- إدراج نوع المنتج
    INSERT INTO product_product_types (product_id, product_type_id)
    VALUES (barcelona_product_id, product_type_id_clothing)
    ON CONFLICT DO NOTHING;
    
    -- البحث عن قسم الرجال أو إنشاؤه
    SELECT id INTO department_id_men FROM departments WHERE LOWER(name) = 'رجالي' OR LOWER(name) = 'رجال' LIMIT 1;
    IF department_id_men IS NULL THEN
        INSERT INTO departments (name, description, icon, color) 
        VALUES ('رجالي', 'منتجات رجالية', 'User', 'from-blue-500 to-blue-600') 
        RETURNING id INTO department_id_men;
    END IF;
    
    -- إدراج القسم
    INSERT INTO product_departments (product_id, department_id)
    VALUES (barcelona_product_id, department_id_men)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'تم إصلاح تصنيفات منتج برشلونة بنجاح';
    RAISE NOTICE 'التصنيفات المضافة: رجالي, ملابس, صيفي, تراك';
    RAISE NOTICE 'نوع المنتج: ملابس';
    RAISE NOTICE 'القسم: رجالي';
    
END $$;