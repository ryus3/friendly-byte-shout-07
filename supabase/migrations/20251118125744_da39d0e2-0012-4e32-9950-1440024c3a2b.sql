-- ✅ المرحلة 1: إضافة عمود is_partial_delivery لحماية دائمة
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_partial_delivery BOOLEAN DEFAULT FALSE;

-- ✅ المرحلة 2: ملء القيم للطلبات الموجودة
UPDATE orders
SET is_partial_delivery = TRUE
WHERE status = 'partial_delivery' 
   OR EXISTS (
     SELECT 1 FROM partial_delivery_history 
     WHERE order_id = orders.id
   );

-- ✅ المرحلة 3: إصلاح الطلب 112066293
UPDATE orders
SET 
  status = 'partial_delivery',
  is_partial_delivery = TRUE,
  final_amount = 33000,
  updated_at = NOW()
WHERE tracking_number = '112066293';

-- ✅ المرحلة 4: إنشاء دالة تعيين علامة التسليم الجزئي تلقائياً
CREATE OR REPLACE FUNCTION mark_order_as_partial_delivery()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET 
    is_partial_delivery = TRUE,
    status = CASE 
      WHEN status NOT IN ('completed', 'delivered') THEN 'partial_delivery'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.order_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ المرحلة 5: إنشاء trigger تلقائي
DROP TRIGGER IF EXISTS set_partial_delivery_flag ON partial_delivery_history;

CREATE TRIGGER set_partial_delivery_flag
AFTER INSERT ON partial_delivery_history
FOR EACH ROW
EXECUTE FUNCTION mark_order_as_partial_delivery();

-- ✅ التحقق من النتيجة
SELECT 
  tracking_number,
  status,
  is_partial_delivery,
  delivery_status,
  total_amount,
  final_amount,
  (SELECT delivered_revenue FROM partial_delivery_history WHERE order_id = orders.id LIMIT 1) as correct_revenue
FROM orders
WHERE tracking_number = '112066293';