-- إصلاح مشكلة الحسابات الخاطئة في الطلبات
-- المشكلة: total_amount يحتوي على سعر المنتجات + التوصيل بدلاً من سعر المنتجات فقط

-- أولاً: إصلاح الطلبات الموجودة بالحسابات الخاطئة
WITH correct_calculations AS (
  SELECT 
    o.id,
    o.order_number,
    o.total_amount as current_total,
    o.final_amount as current_final,
    o.delivery_fee,
    o.discount,
    COALESCE((SELECT SUM(oi.total_price) FROM order_items oi WHERE oi.order_id = o.id), 0) as correct_total,
    COALESCE((SELECT SUM(oi.total_price) FROM order_items oi WHERE oi.order_id = o.id), 0) + COALESCE(o.delivery_fee, 0) - COALESCE(o.discount, 0) as correct_final
  FROM orders o
  WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
)
UPDATE orders
SET 
  total_amount = cc.correct_total,
  final_amount = cc.correct_final,
  updated_at = now()
FROM correct_calculations cc
WHERE orders.id = cc.id
  AND (
    orders.total_amount != cc.correct_total 
    OR orders.final_amount != cc.correct_final
  );

-- إنشاء trigger للتحقق من صحة الحسابات عند الإدراج أو التحديث
CREATE OR REPLACE FUNCTION validate_order_calculations()
RETURNS TRIGGER AS $$
DECLARE
  items_total NUMERIC := 0;
  correct_final NUMERIC := 0;
BEGIN
  -- حساب مجموع أسعار العناصر
  SELECT COALESCE(SUM(total_price), 0) INTO items_total
  FROM order_items 
  WHERE order_id = NEW.id;
  
  -- حساب المجموع النهائي الصحيح
  correct_final := items_total + COALESCE(NEW.delivery_fee, 0) - COALESCE(NEW.discount, 0);
  
  -- تصحيح القيم إذا كانت خاطئة
  IF items_total > 0 THEN
    NEW.total_amount := items_total;
    NEW.final_amount := correct_final;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الـ trigger بجدول الطلبات
DROP TRIGGER IF EXISTS validate_order_calculations_trigger ON orders;
CREATE TRIGGER validate_order_calculations_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_calculations();

-- إنشاء trigger للتحقق من الحسابات عند تحديث order_items
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  order_id_to_update UUID;
  items_total NUMERIC := 0;
  order_delivery_fee NUMERIC := 0;
  order_discount NUMERIC := 0;
  correct_final NUMERIC := 0;
BEGIN
  -- تحديد معرف الطلب
  IF TG_OP = 'DELETE' THEN
    order_id_to_update := OLD.order_id;
  ELSE
    order_id_to_update := NEW.order_id;
  END IF;
  
  -- حساب مجموع أسعار العناصر
  SELECT COALESCE(SUM(total_price), 0) INTO items_total
  FROM order_items 
  WHERE order_id = order_id_to_update;
  
  -- الحصول على رسوم التوصيل والخصم
  SELECT COALESCE(delivery_fee, 0), COALESCE(discount, 0)
  INTO order_delivery_fee, order_discount
  FROM orders 
  WHERE id = order_id_to_update;
  
  -- حساب المجموع النهائي
  correct_final := items_total + order_delivery_fee - order_discount;
  
  -- تحديث الطلب
  UPDATE orders 
  SET 
    total_amount = items_total,
    final_amount = correct_final,
    updated_at = now()
  WHERE id = order_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ربط الـ trigger بجدول عناصر الطلبات
DROP TRIGGER IF EXISTS recalculate_order_totals_trigger ON order_items;
CREATE TRIGGER recalculate_order_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_order_totals();