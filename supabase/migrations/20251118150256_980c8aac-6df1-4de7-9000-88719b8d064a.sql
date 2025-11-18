-- إصلاح شامل: trigger إرجاع المخزون + منطق المزامنة بين الشركات

-- ============================================
-- الجزء 1: إصلاح trigger إرجاع المخزون
-- ============================================
-- المشكلة: كان يحاول تحديث product_variants.quantity لكن العمود الصحيح في جدول inventory.quantity
-- الحل: تحديث inventory.quantity مباشرة

CREATE OR REPLACE FUNCTION process_returned_order_inventory()
RETURNS TRIGGER AS $$
DECLARE
  order_item RECORD;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status = 'returned_in_stock' AND OLD.status != 'returned_in_stock') THEN
    FOR order_item IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      -- ✅ تحديث المخزون الفعلي في جدول inventory
      UPDATE inventory
      SET 
        quantity = quantity + order_item.quantity,
        updated_at = now(),
        last_updated_by = COALESCE(NEW.created_by, auth.uid()::text)
      WHERE variant_id = order_item.variant_id;
      
      -- حذف من سجل المبيعات إذا كان موجوداً
      DELETE FROM sold_products_log
      WHERE order_id = NEW.id AND variant_id = order_item.variant_id;
      
      RAISE NOTICE '✅ تم إرجاع % وحدة من المنتج % للمخزون الفعلي', order_item.quantity, order_item.variant_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_returned_order_inventory() IS 'إرجاع المنتجات إلى المخزون الفعلي عند حالة returned_in_stock - تم إصلاحه 2025-11-18';

-- إعادة إنشاء trigger
DROP TRIGGER IF EXISTS trigger_process_returned_inventory ON orders;
CREATE TRIGGER trigger_process_returned_inventory
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'returned_in_stock' AND OLD.status IS DISTINCT FROM 'returned_in_stock')
  EXECUTE FUNCTION process_returned_order_inventory();

-- ============================================
-- الجزء 2: إصلاح الطلب 112066847
-- ============================================
-- إعادة معالجة الطلب يدوياً لإرجاع المخزون الذي لم يتم إرجاعه بسبب الـ trigger الخاطئ

DO $$
DECLARE
  order_rec RECORD;
  item_rec RECORD;
BEGIN
  -- جلب الطلب
  SELECT * INTO order_rec FROM orders WHERE tracking_number = '112066847' AND status = 'returned_in_stock';
  
  IF FOUND THEN
    RAISE NOTICE '🔧 إعادة معالجة الطلب 112066847...';
    
    -- إرجاع المنتجات للمخزون
    FOR item_rec IN 
      SELECT * FROM order_items WHERE order_id = order_rec.id
    LOOP
      UPDATE inventory
      SET 
        quantity = quantity + item_rec.quantity,
        updated_at = now()
      WHERE variant_id = item_rec.variant_id;
      
      RAISE NOTICE '✅ تم إضافة % وحدة للمخزون الفعلي', item_rec.quantity;
    END LOOP;
  ELSE
    RAISE NOTICE '⚠️ الطلب 112066847 غير موجود أو ليس في حالة returned_in_stock';
  END IF;
END;
$$;

-- التحقق من النتائج
SELECT 
  o.tracking_number,
  o.status,
  o.delivery_status,
  p.name as product_name,
  i.quantity as stock_after_fix,
  i.reserved_quantity
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN inventory i ON oi.variant_id = i.variant_id
LEFT JOIN products p ON i.product_id = p.id
WHERE o.tracking_number = '112066847';