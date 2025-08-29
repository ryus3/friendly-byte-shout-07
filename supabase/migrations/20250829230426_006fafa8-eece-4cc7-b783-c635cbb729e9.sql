-- استعادة تصنيفات منتج برشلونة
-- البحث عن منتج برشلونة واستعادة تصنيفاته المفقودة

DO $$
DECLARE
  barcelona_product_id UUID;
  clothes_dept_id UUID := '9d3c152e-8143-4ff6-af71-c5a1312b8b55';
  male_category_id UUID := 'ec70b29b-4cbf-4929-8080-48ac6a08a280';
  track_type_id UUID := '5638e685-07e2-4eeb-a137-445287ccab88';
  summer_season_id UUID := '4d47caae-05ee-426d-a600-03ebcf050356';
BEGIN
  -- البحث عن منتج برشلونة
  SELECT id INTO barcelona_product_id 
  FROM products 
  WHERE name ILIKE '%برشلونة%' 
  LIMIT 1;
  
  IF barcelona_product_id IS NOT NULL THEN
    -- حذف التصنيفات الموجودة (إن وجدت)
    DELETE FROM product_departments WHERE product_id = barcelona_product_id;
    DELETE FROM product_categories WHERE product_id = barcelona_product_id;
    DELETE FROM product_product_types WHERE product_id = barcelona_product_id;
    DELETE FROM product_seasons_occasions WHERE product_id = barcelona_product_id;
    
    -- إدراج التصنيفات الصحيحة
    INSERT INTO product_departments (product_id, department_id) 
    VALUES (barcelona_product_id, clothes_dept_id);
    
    INSERT INTO product_categories (product_id, category_id) 
    VALUES (barcelona_product_id, male_category_id);
    
    INSERT INTO product_product_types (product_id, product_type_id) 
    VALUES (barcelona_product_id, track_type_id);
    
    INSERT INTO product_seasons_occasions (product_id, season_occasion_id) 
    VALUES (barcelona_product_id, summer_season_id);
    
    RAISE NOTICE 'تم استعادة تصنيفات منتج برشلونة بنجاح: قسم=ملابس، تصنيف=رجالي، نوع=تراك، موسم=صيفي';
  ELSE
    RAISE NOTICE 'لم يتم العثور على منتج برشلونة';
  END IF;
END $$;