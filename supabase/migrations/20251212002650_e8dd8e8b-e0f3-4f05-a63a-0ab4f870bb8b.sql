-- 1️⃣ إصلاح ORD000252 فوراً
UPDATE orders 
SET 
  receipt_received = true,
  receipt_received_at = '2025-12-12 00:14:15.916262+00',
  receipt_received_by = '91484496-b887-44f7-9e5d-be9db5567604'
WHERE order_number = 'ORD000252'
AND receipt_received = false;

-- 2️⃣ إنشاء حركة نقدية للطلب (إذا لم تكن موجودة)
INSERT INTO cash_movements (
  cash_source_id,
  movement_type,
  amount,
  reference_type,
  reference_id,
  description,
  created_by,
  effective_at
)
SELECT 
  (SELECT id FROM cash_sources WHERE is_active = true ORDER BY created_at LIMIT 1),
  'in',
  o.final_amount - COALESCE(o.delivery_fee, 0),
  'order',
  o.id,
  'إيراد طلب مُسلَّم #' || o.order_number,
  '91484496-b887-44f7-9e5d-be9db5567604',
  '2025-12-12 00:14:15.916262+00'
FROM orders o
WHERE o.order_number = 'ORD000252'
AND NOT EXISTS (
  SELECT 1 FROM cash_movements cm 
  WHERE cm.reference_id = o.id 
  AND cm.reference_type = 'order' 
  AND cm.movement_type = 'in'
);

-- 3️⃣ Trigger إضافي للحماية المستقبلية
CREATE OR REPLACE FUNCTION ensure_all_invoice_orders_received()
RETURNS TRIGGER AS $$
BEGIN
  -- عند أي تحديث لفاتورة مستلمة، تأكد من أن كل الطلبات المربوطة مستلمة
  IF NEW.received = true THEN
    UPDATE orders
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(orders.receipt_received_at, NEW.received_at, NOW()),
      receipt_received_by = COALESCE(orders.receipt_received_by, NEW.owner_user_id)
    WHERE id IN (
      SELECT order_id FROM delivery_invoice_orders WHERE invoice_id = NEW.id AND order_id IS NOT NULL
    )
    AND receipt_received = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- حذف trigger قديم إن وجد
DROP TRIGGER IF EXISTS ensure_invoice_orders_complete ON delivery_invoices;

-- إنشاء trigger جديد يعمل عند أي تحديث للفاتورة المستلمة
CREATE TRIGGER ensure_invoice_orders_complete
  AFTER UPDATE ON delivery_invoices
  FOR EACH ROW
  WHEN (NEW.received = true)
  EXECUTE FUNCTION ensure_all_invoice_orders_received();