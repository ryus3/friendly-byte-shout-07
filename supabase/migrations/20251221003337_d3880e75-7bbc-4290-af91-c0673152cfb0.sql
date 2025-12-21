-- حذف الـ trigger الذي تم إنشاؤه (إن وُجد)
DROP TRIGGER IF EXISTS auto_sync_order_receipt_on_link ON delivery_invoice_orders;

-- تعديل الدالة لتضمين receipt_received_by
CREATE OR REPLACE FUNCTION sync_order_receipt_on_invoice_link()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_received boolean;
  v_received_at timestamptz;
  v_owner_user_id uuid;
BEGIN
  -- التحقق من حالة الفاتورة ومالكها
  SELECT received, received_at, owner_user_id 
  INTO v_is_received, v_received_at, v_owner_user_id
  FROM delivery_invoices
  WHERE id = NEW.invoice_id;

  -- إذا الفاتورة مستلمة، حدّث الطلب
  IF v_is_received = true THEN
    UPDATE orders
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(v_received_at, NOW()),
      receipt_received_by = COALESCE(v_owner_user_id, created_by),
      updated_at = NOW()
    WHERE delivery_partner_order_id = NEW.external_order_id
      AND receipt_received = false;
  END IF;

  RETURN NEW;
END;
$$;

-- إعادة إنشاء الـ Trigger
CREATE TRIGGER auto_sync_order_receipt_on_link
  AFTER INSERT OR UPDATE ON delivery_invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_receipt_on_invoice_link();

-- إصلاح البيانات الحالية مع تحديد receipt_received_by
UPDATE orders o
SET 
  receipt_received = true,
  receipt_received_at = COALESCE(di.received_at, NOW()),
  receipt_received_by = COALESCE(di.owner_user_id, o.created_by),
  updated_at = NOW()
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON dio.invoice_id = di.id
WHERE dio.external_order_id = o.delivery_partner_order_id
  AND di.received = true
  AND o.receipt_received = false;