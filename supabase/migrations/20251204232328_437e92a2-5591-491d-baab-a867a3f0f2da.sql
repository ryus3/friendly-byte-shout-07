
-- =====================================================
-- توحيد المبيعات (sold_quantity) في قاعدة البيانات
-- المصدر الصحيح: get_products_sold_stats()
-- =====================================================

-- المرحلة 1: تصحيح البيانات الحالية
-- ==========================================

-- 1.1 تحديث inventory.sold_quantity من الدالة الصحيحة
UPDATE inventory i
SET sold_quantity = COALESCE(pss.total_quantity_sold, 0),
    updated_at = now()
FROM get_products_sold_stats() pss
WHERE i.variant_id = pss.variant_id;

-- 1.2 المنتجات بدون مبيعات = 0
UPDATE inventory 
SET sold_quantity = 0,
    updated_at = now()
WHERE variant_id NOT IN (SELECT variant_id FROM get_products_sold_stats())
  AND sold_quantity != 0;

-- المرحلة 2: Trigger للتسليم الكامل (delivery_status = '4')
-- ==========================================

-- حذف الدالة والـ trigger إذا وجدت
DROP TRIGGER IF EXISTS trg_update_sold_on_delivery ON orders;
DROP FUNCTION IF EXISTS update_sold_on_full_delivery();

-- إنشاء الدالة
CREATE OR REPLACE FUNCTION update_sold_on_full_delivery()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- فقط عند تغيير delivery_status إلى '4' (مسلم)
  -- وليس من طلب partial_delivery (لأن له trigger خاص)
  IF NEW.delivery_status = '4' 
     AND (OLD.delivery_status IS NULL OR OLD.delivery_status != '4')
     AND COALESCE(NEW.order_type, '') != 'partial_delivery' THEN
    
    -- زيادة sold_quantity لكل منتجات الطلب
    UPDATE inventory i
    SET sold_quantity = COALESCE(i.sold_quantity, 0) + oi.quantity,
        updated_at = now()
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND i.variant_id = oi.variant_id
      AND COALESCE(oi.item_direction, 'outgoing') = 'outgoing';
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ trigger
CREATE TRIGGER trg_update_sold_on_delivery
AFTER UPDATE OF delivery_status ON orders
FOR EACH ROW
EXECUTE FUNCTION update_sold_on_full_delivery();

-- المرحلة 3: Trigger للتسليم الجزئي (item_status = 'delivered')
-- ==========================================

-- حذف الدالة والـ trigger إذا وجدت
DROP TRIGGER IF EXISTS trg_update_sold_on_partial ON order_items;
DROP FUNCTION IF EXISTS update_sold_on_partial_delivery();

-- إنشاء الدالة
CREATE OR REPLACE FUNCTION update_sold_on_partial_delivery()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_order_type text;
BEGIN
  -- التحقق من أن الطلب من نوع partial_delivery
  SELECT order_type INTO v_order_type 
  FROM orders WHERE id = NEW.order_id;
  
  -- فقط عند تغيير item_status إلى 'delivered' في طلب partial_delivery
  IF v_order_type = 'partial_delivery' 
     AND NEW.item_status = 'delivered' 
     AND (OLD.item_status IS NULL OR OLD.item_status != 'delivered')
     AND COALESCE(NEW.item_direction, 'outgoing') = 'outgoing' THEN
    
    -- زيادة sold_quantity للمنتج المحدد فقط
    UPDATE inventory
    SET sold_quantity = COALESCE(sold_quantity, 0) + NEW.quantity,
        updated_at = now()
    WHERE variant_id = NEW.variant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ trigger
CREATE TRIGGER trg_update_sold_on_partial
AFTER UPDATE OF item_status ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_sold_on_partial_delivery();

-- إضافة تعليقات توضيحية
COMMENT ON FUNCTION update_sold_on_full_delivery() IS 'تحديث sold_quantity عند تسليم طلب كامل (delivery_status=4)';
COMMENT ON FUNCTION update_sold_on_partial_delivery() IS 'تحديث sold_quantity عند تسليم منتج في طلب جزئي (item_status=delivered)';
