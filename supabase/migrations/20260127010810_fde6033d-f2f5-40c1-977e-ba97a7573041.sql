-- الخطوة 1: تصحيح الطلب #121313050
UPDATE orders 
SET status = 'delivered'
WHERE tracking_number = '121313050' 
  AND receipt_received = false;

-- الخطوة 2: إصلاح أي طلبات مشابهة (completed بدون فاتورة مستلمة)
UPDATE orders 
SET status = 'delivered'
WHERE status = 'completed' 
  AND receipt_received = false
  AND delivery_status = '4';