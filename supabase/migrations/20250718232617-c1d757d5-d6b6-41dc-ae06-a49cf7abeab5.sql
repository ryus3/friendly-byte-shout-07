-- تحديث المنتجات الموجودة التي لا تحتوي على باركود
UPDATE products 
SET barcode = generate_product_barcode(name, 'DEFAULT', 'DEFAULT', id)
WHERE barcode IS NULL OR barcode = '';

-- تحديث المتغيرات الموجودة التي لا تحتوي على باركود
UPDATE product_variants pv
SET barcode = generate_product_barcode(
  (SELECT p.name FROM products p WHERE p.id = pv.product_id),
  COALESCE((SELECT c.name FROM colors c WHERE c.id = pv.color_id), 'DEFAULT'),
  COALESCE((SELECT s.name FROM sizes s WHERE s.id = pv.size_id), 'DEFAULT'),
  pv.product_id
)
WHERE barcode IS NULL OR barcode = '';

-- إنشاء trigger لتوليد باركود تلقائي للمنتجات الجديدة
CREATE OR REPLACE FUNCTION auto_generate_product_barcode()
RETURNS TRIGGER AS $$
BEGIN
  -- إذا لم يتم توفير باركود، قم بتوليد واحد
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    NEW.barcode := generate_product_barcode(NEW.name, 'DEFAULT', 'DEFAULT', NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول المنتجات
DROP TRIGGER IF EXISTS trigger_auto_generate_product_barcode ON products;
CREATE TRIGGER trigger_auto_generate_product_barcode
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_product_barcode();

-- إنشاء trigger لتوليد باركود تلقائي للمتغيرات الجديدة
CREATE OR REPLACE FUNCTION auto_generate_variant_barcode()
RETURNS TRIGGER AS $$
DECLARE
  product_name TEXT;
  color_name TEXT;
  size_name TEXT;
BEGIN
  -- إذا لم يتم توفير باركود، قم بتوليد واحد
  IF NEW.barcode IS NULL OR NEW.barcode = '' THEN
    -- الحصول على أسماء المنتج واللون والحجم
    SELECT p.name INTO product_name FROM products p WHERE p.id = NEW.product_id;
    SELECT c.name INTO color_name FROM colors c WHERE c.id = NEW.color_id;
    SELECT s.name INTO size_name FROM sizes s WHERE s.id = NEW.size_id;
    
    NEW.barcode := generate_product_barcode(
      COALESCE(product_name, 'PRODUCT'),
      COALESCE(color_name, 'DEFAULT'),
      COALESCE(size_name, 'DEFAULT'),
      NEW.product_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول المتغيرات
DROP TRIGGER IF EXISTS trigger_auto_generate_variant_barcode ON product_variants;
CREATE TRIGGER trigger_auto_generate_variant_barcode
  BEFORE INSERT OR UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_variant_barcode();