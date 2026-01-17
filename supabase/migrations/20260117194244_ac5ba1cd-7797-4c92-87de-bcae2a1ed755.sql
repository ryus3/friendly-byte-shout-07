-- ============================================
-- المرحلة 4: تحصين وظيفة reconcile_invoice_receipts
-- إضافة Reset نشط للطلبات الراجعة
-- ============================================

-- حذف الوظيفة القديمة أولاً
DROP FUNCTION IF EXISTS public.reconcile_invoice_receipts() CASCADE;

-- إعادة إنشاء الوظيفة المحسنة
CREATE OR REPLACE FUNCTION public.reconcile_invoice_receipts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_eligible_count int := 0;
  v_reset_count int := 0;
BEGIN
  -- فقط عند تحديث status_normalized إلى 'received'
  IF NEW.status_normalized = 'received' AND (OLD.status_normalized IS DISTINCT FROM 'received') THEN
    
    -- الخطوة 1: Reset نشط - تصفير أي طلب راجع/مرفوض تم وسمه بالخطأ
    UPDATE orders o SET 
      receipt_received = false,
      receipt_received_at = NULL,
      receipt_received_by = NULL
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND (
        o.delivery_status = '17'
        OR o.status IN ('returned', 'rejected', 'cancelled', 'returned_in_stock')
      )
      AND o.order_type != 'partial_delivery'
      AND o.receipt_received = true;
    
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;
    
    IF v_reset_count > 0 THEN
      RAISE LOG 'reconcile_invoice_receipts: Reset % ineligible orders for invoice %', v_reset_count, NEW.external_id;
    END IF;
    
    -- الخطوة 2: وسم الطلبات المؤهلة فقط
    FOR v_order_id IN
      SELECT dio.order_id
      FROM delivery_invoice_orders dio
      JOIN orders o ON o.id = dio.order_id
      WHERE dio.invoice_id = NEW.id
        AND o.receipt_received = false
        AND (
          o.status IN ('delivered', 'completed', 'partial_delivery')
          OR o.delivery_status IN ('4', '5', '21')
        )
        AND o.order_type != 'partial_delivery'
        AND o.delivery_status != '17'
        AND o.status NOT IN ('returned', 'rejected', 'cancelled', 'returned_in_stock')
    LOOP
      UPDATE orders SET
        receipt_received = true,
        receipt_received_at = COALESCE(NEW.received_at, NOW()),
        delivery_partner_invoice_id = NEW.external_id
      WHERE id = v_order_id
        AND receipt_received = false;
      
      v_eligible_count := v_eligible_count + 1;
    END LOOP;
    
    -- معالجة التسليم الجزئي: يُربط بالفاتورة لكن بدون cash movement تلقائي
    UPDATE orders o SET
      delivery_partner_invoice_id = NEW.external_id
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.order_type = 'partial_delivery'
      AND o.delivery_partner_invoice_id IS NULL;
    
    RAISE LOG 'reconcile_invoice_receipts: Marked % eligible orders for invoice %', v_eligible_count, NEW.external_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ trigger
CREATE TRIGGER trg_reconcile_invoice_receipts
  AFTER UPDATE ON delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_invoice_receipts();