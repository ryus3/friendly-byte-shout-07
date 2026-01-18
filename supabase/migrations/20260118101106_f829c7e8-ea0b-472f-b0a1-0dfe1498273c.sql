-- المرحلة A: حذف النسخة المكررة من update_invoice_sync_schedule (التي تقبل TIME)
DROP FUNCTION IF EXISTS update_invoice_sync_schedule(boolean, text, time without time zone, time without time zone);

-- المرحلة B: إنشاء Trigger التسوية على delivery_invoices
-- أولاً: إنشاء دالة trigger بسيطة
CREATE OR REPLACE FUNCTION reconcile_invoice_receipts_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- عند تغيير status_normalized إلى received
  IF NEW.status_normalized = 'received' AND (OLD.status_normalized IS DISTINCT FROM 'received') THEN
    UPDATE orders o
    SET receipt_received = true
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received IS NOT TRUE;
  END IF;
  
  -- عند تغيير status_normalized من received إلى شيء آخر
  IF OLD.status_normalized = 'received' AND NEW.status_normalized != 'received' THEN
    UPDATE orders o
    SET receipt_received = false
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND o.receipt_received = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ Trigger
DROP TRIGGER IF EXISTS trg_reconcile_invoice_receipts ON delivery_invoices;
CREATE TRIGGER trg_reconcile_invoice_receipts
  AFTER UPDATE ON delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_invoice_receipts_trigger();

-- المرحلة B2: تسوية شاملة لمرة واحدة لتصحيح الحالات المتراكمة
UPDATE orders o
SET receipt_received = true
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON di.id = dio.invoice_id
WHERE dio.order_id = o.id
  AND di.status_normalized = 'received'
  AND o.receipt_received IS NOT TRUE;