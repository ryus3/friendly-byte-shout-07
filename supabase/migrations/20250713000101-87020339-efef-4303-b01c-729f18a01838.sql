-- إضافة "فري سايز" إلى القياسات إذا لم يكن موجوداً
INSERT INTO public.sizes (name, type, display_order)
SELECT 'فري سايز', 'free', 999
WHERE NOT EXISTS (
  SELECT 1 FROM public.sizes 
  WHERE name = 'فري سايز' AND type = 'free'
);

-- إضافة بعض القياسات الحرفية الأساسية إذا لم تكن موجودة
INSERT INTO public.sizes (name, type, display_order)
SELECT unnest(ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL']), 'letter', generate_series(1, 6)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sizes 
  WHERE type = 'letter'
)
ON CONFLICT DO NOTHING;

-- إضافة بعض القياسات الرقمية الأساسية إذا لم تكن موجودة
INSERT INTO public.sizes (name, type, display_order)
SELECT size_name, 'number', row_number() over() + 100
FROM (
  SELECT unnest(ARRAY['38', '39', '40', '41', '42', '43', '44', '45', '46']) as size_name
) sizes_list
WHERE NOT EXISTS (
  SELECT 1 FROM public.sizes 
  WHERE type = 'number'
)
ON CONFLICT DO NOTHING;