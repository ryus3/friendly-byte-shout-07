-- تحديث الباركود للمنتجات والمتغيرات الموجودة التي لا تحتوي على باركود

-- إضافة دالة لتوليد باركود فريد في قاعدة البيانات
CREATE OR REPLACE FUNCTION generate_product_barcode(
  p_product_name TEXT,
  p_color_name TEXT DEFAULT 'DEFAULT',
  p_size_name TEXT DEFAULT 'DEFAULT',
  p_product_id UUID DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  product_code TEXT;
  color_code TEXT;
  size_code TEXT;
  timestamp_code TEXT;
  random_code TEXT;
  final_barcode TEXT;
BEGIN
  -- تنظيف وتقصير النصوص
  product_code := UPPER(LEFT(REGEXP_REPLACE(p_product_name, '[^a-zA-Z0-9]', '', 'g'), 3));
  color_code := UPPER(LEFT(REGEXP_REPLACE(p_color_name, '[^a-zA-Z0-9]', '', 'g'), 3));
  size_code := UPPER(LEFT(REGEXP_REPLACE(p_size_name, '[^a-zA-Z0-9]', '', 'g'), 2));
  
  -- إذا كانت النصوص فارغة، استخدم افتراضية
  IF product_code = '' THEN product_code := 'PRD'; END IF;
  IF color_code = '' THEN color_code := 'CLR'; END IF;
  IF size_code = '' THEN size_code := 'SZ'; END IF;
  
  -- إضافة timestamp ورقم عشوائي
  timestamp_code := RIGHT(EXTRACT(epoch FROM NOW())::TEXT, 4);
  random_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 2));
  
  -- تكوين الباركود النهائي
  final_barcode := product_code || color_code || size_code || timestamp_code || random_code;
  
  -- التأكد من أنه لا يتجاوز 20 حرف
  RETURN LEFT(final_barcode, 20);
END;
$$;

-- تحديث المنتجات التي لا تحتوي على باركود
UPDATE products 
SET barcode = generate_product_barcode(name, 'PRODUCT', 'MAIN', id)
WHERE barcode IS NULL OR barcode = '';

-- تحديث المتغيرات التي لا تحتوي على باركود
UPDATE product_variants 
SET barcode = generate_product_barcode(
  (SELECT name FROM products WHERE id = product_variants.product_id),
  COALESCE((SELECT name FROM colors WHERE id = product_variants.color_id), 'DEFAULT'),
  COALESCE((SELECT name FROM sizes WHERE id = product_variants.size_id), 'DEFAULT'),
  product_id
)
WHERE barcode IS NULL OR barcode = '';

-- إضافة فهرس لتسريع البحث بالباركود
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);