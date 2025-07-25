-- إضافة حقل QR ID للطلبات
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_id text UNIQUE;

-- إنشاء فهرس للبحث السريع بـ QR ID
CREATE INDEX IF NOT EXISTS idx_orders_qr_id ON orders(qr_id);

-- إنشاء دالة لتوليد QR ID فريد للطلبات
CREATE OR REPLACE FUNCTION generate_order_qr_id()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  qr_prefix text := 'QR-ORD-';
  random_suffix text;
  qr_id text;
  counter integer := 0;
BEGIN
  LOOP
    -- توليد رقم عشوائي من 6 أرقام
    random_suffix := LPAD((RANDOM() * 999999)::integer::text, 6, '0');
    qr_id := qr_prefix || random_suffix;
    
    -- التحقق من عدم وجود هذا الـ QR ID
    IF NOT EXISTS (SELECT 1 FROM orders WHERE qr_id = qr_id) THEN
      RETURN qr_id;
    END IF;
    
    counter := counter + 1;
    -- منع الحلقة اللانهائية
    IF counter > 1000 THEN
      -- إضافة timestamp للتأكد من الفرادة
      qr_id := qr_prefix || EXTRACT(EPOCH FROM now())::bigint || '-' || random_suffix;
      RETURN qr_id;
    END IF;
  END LOOP;
END;
$$;

-- إنشاء trigger لتوليد QR ID تلقائياً للطلبات الجديدة
CREATE OR REPLACE FUNCTION auto_generate_order_qr_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.qr_id IS NULL OR NEW.qr_id = '' THEN
    NEW.qr_id := generate_order_qr_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ربط الـ trigger بجدول الطلبات
DROP TRIGGER IF EXISTS trigger_auto_generate_order_qr_id ON orders;
CREATE TRIGGER trigger_auto_generate_order_qr_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_order_qr_id();

-- تحديث الطلبات الموجودة لإضافة QR ID
UPDATE orders 
SET qr_id = generate_order_qr_id() 
WHERE qr_id IS NULL OR qr_id = '';