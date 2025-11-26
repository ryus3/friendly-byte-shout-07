-- ============================================
-- الخطة الشاملة: إصلاح مشكلة تغيير التاريخ
-- ============================================

-- المرحلة 1: إصلاح الـ Trigger ليستخدم التاريخ الحقيقي من الفاتورة
-- ============================================

DROP TRIGGER IF EXISTS trigger_auto_update_invoice_orders ON delivery_invoices;

CREATE OR REPLACE FUNCTION auto_update_linked_orders_on_invoice_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- ✅ CRITICAL: استخدام received_at من الفاتورة بدلاً من NOW()
  -- هذا يحفظ التاريخ الحقيقي لاستلام الفاتورة ولا يتغير عند التحديث
  UPDATE orders
  SET 
    receipt_received = true,
    receipt_received_at = COALESCE(NEW.received_at, NOW()),
    receipt_received_by = NEW.owner_user_id
  WHERE id IN (
    SELECT order_id 
    FROM delivery_invoice_orders 
    WHERE invoice_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_update_linked_orders_on_invoice_receipt() IS 
'إصلاح 26/11/2025: استخدام received_at من الفاتورة بدلاً من NOW() لمنع تغيير التاريخ';

-- إعادة إنشاء الـ Trigger
CREATE TRIGGER trigger_auto_update_invoice_orders
  AFTER UPDATE OF received
  ON delivery_invoices
  FOR EACH ROW
  WHEN (NEW.received = true AND OLD.received = false)
  EXECUTE FUNCTION auto_update_linked_orders_on_invoice_receipt();

-- ============================================
-- المرحلة 2: تصحيح البيانات الموجودة
-- ============================================

-- تحديث التواريخ الخاطئة للطلبات الثلاثة المتأثرة
-- استخدام تاريخ الفاتورة الحقيقي بدلاً من 26/11

DO $$
DECLARE
  affected_orders RECORD;
  invoice_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- جلب الطلبات الثلاثة المتأثرة مع تواريخ فواتيرهم الحقيقية
  FOR affected_orders IN
    SELECT 
      o.id as order_id,
      o.tracking_number,
      o.receipt_received_at as current_wrong_date,
      di.received_at as correct_invoice_date,
      di.external_id as invoice_id
    FROM orders o
    JOIN delivery_invoice_orders dio ON o.id = dio.order_id
    JOIN delivery_invoices di ON dio.invoice_id = di.id
    WHERE o.tracking_number IN ('113138197', '113256936', '113591250')
      AND o.receipt_received = true
      AND DATE(o.receipt_received_at) = '2025-11-26' -- التاريخ الخاطئ
  LOOP
    -- تحديث التاريخ للتاريخ الصحيح من الفاتورة
    UPDATE orders
    SET receipt_received_at = affected_orders.correct_invoice_date
    WHERE id = affected_orders.order_id;
    
    RAISE NOTICE 'تم تصحيح تاريخ الطلب % من % إلى %', 
      affected_orders.tracking_number,
      affected_orders.current_wrong_date,
      affected_orders.correct_invoice_date;
  END LOOP;
  
  RAISE NOTICE 'اكتمل تصحيح التواريخ للطلبات الثلاثة';
END $$;