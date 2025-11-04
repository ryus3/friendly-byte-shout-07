-- إصلاح الطلبات المكتملة بالخطأ
-- إرجاع الطلبات من completed إلى delivered
UPDATE orders
SET status = 'delivered'
WHERE status = 'completed'
  AND receipt_received = false
  AND delivery_status = '4';