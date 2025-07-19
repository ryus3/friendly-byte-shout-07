-- إضافة عمود shipping_cost منفصل لجدول purchases
ALTER TABLE purchases ADD COLUMN shipping_cost NUMERIC DEFAULT 0;

-- إضافة عمود purchase_date لحفظ تاريخ الشراء الفعلي
ALTER TABLE purchases ADD COLUMN purchase_date DATE DEFAULT CURRENT_DATE;

-- تحديث الفاتورة الحالية لفصل تكلفة الشحن
UPDATE purchases 
SET 
  shipping_cost = 5000,
  purchase_date = '2025-07-19'::date,
  total_amount = 29000 -- إجمالي المنتجات فقط
WHERE purchase_number = '1';

-- إضافة trigger لحساب إجمالي الفاتورة تلقائياً
CREATE OR REPLACE FUNCTION calculate_purchase_total()
RETURNS TRIGGER AS $$
BEGIN
  -- حساب إجمالي الفاتورة = إجمالي المنتجات + تكلفة الشحن
  NEW.total_amount = COALESCE(NEW.total_amount, 0) + COALESCE(NEW.shipping_cost, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الـ trigger بجدول purchases
DROP TRIGGER IF EXISTS trigger_calculate_purchase_total ON purchases;
CREATE TRIGGER trigger_calculate_purchase_total
  BEFORE INSERT OR UPDATE ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION calculate_purchase_total();

-- تحديث الفاتورة الحالية مرة أخرى بعد إضافة التrigger
UPDATE purchases 
SET 
  shipping_cost = 5000,
  purchase_date = '2025-07-19'::date
WHERE purchase_number = '1';