-- إضافة بعض التصنيفات الأساسية إذا لم تكن موجودة
INSERT INTO public.categories (name, type, description)
SELECT name, type, description 
FROM (VALUES 
  ('رجالي', 'main_category', 'منتجات رجالية'),
  ('نسائي', 'main_category', 'منتجات نسائية'),
  ('أطفال', 'main_category', 'منتجات الأطفال'),
  ('رياضي', 'main_category', 'الملابس الرياضية'),
  
  ('قمصان', 'product_type', 'قمصان بأنواعها'),
  ('بناطيل', 'product_type', 'بناطيل متنوعة'),
  ('فساتين', 'product_type', 'فساتين'),
  ('أحذية', 'product_type', 'أحذية متنوعة'),
  ('إكسسوارات', 'product_type', 'إكسسوارات متنوعة'),
  
  ('صيفي', 'season_occasion', 'للموسم الصيفي'),
  ('شتوي', 'season_occasion', 'للموسم الشتوي'),
  ('ربيعي', 'season_occasion', 'للموسم الربيعي'),
  ('خريفي', 'season_occasion', 'للموسم الخريفي'),
  ('مناسبات', 'season_occasion', 'للمناسبات الخاصة'),
  ('كاجوال', 'season_occasion', 'للاستخدام اليومي'),
  ('رسمي', 'season_occasion', 'للمناسبات الرسمية')
) AS categories_data(name, type, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories 
  WHERE categories.name = categories_data.name 
  AND categories.type = categories_data.type
);

-- إضافة بعض الأقسام الأساسية إذا لم تكن موجودة
INSERT INTO public.departments (name, description, color, icon, display_order, is_active)
SELECT name, description, color, icon, display_order, is_active 
FROM (VALUES 
  ('ملابس', 'الملابس والأزياء', 'from-blue-500 to-blue-600', 'Shirt', 1, true),
  ('أحذية', 'الأحذية والصنادل', 'from-green-500 to-green-600', 'Footprints', 2, true),
  ('إكسسوارات', 'الإكسسوارات والحقائب', 'from-purple-500 to-purple-600', 'Gem', 3, true),
  ('رياضة', 'الملابس الرياضية', 'from-orange-500 to-orange-600', 'Zap', 4, true),
  ('أطفال', 'منتجات الأطفال', 'from-pink-500 to-pink-600', 'Baby', 5, true)
) AS departments_data(name, description, color, icon, display_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments 
  WHERE departments.name = departments_data.name
);