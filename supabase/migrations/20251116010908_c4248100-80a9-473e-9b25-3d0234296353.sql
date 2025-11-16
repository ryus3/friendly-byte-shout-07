-- إصلاح الطلبات ذات الفواتير بأرقام التتبع المحددة
UPDATE orders
SET 
  receipt_received = true,
  status = 'completed',
  updated_at = now()
WHERE tracking_number IN ('106246427', '98783797', '98713588')
  AND delivery_partner_invoice_id IS NOT NULL
  AND receipt_received = false;

-- إصلاح طلبات الموظف أحمد التي لها فواتير
UPDATE orders
SET 
  receipt_received = true,
  status = 'completed',
  updated_at = now()
WHERE delivery_partner_invoice_id IS NOT NULL
  AND receipt_received = false
  AND status = 'delivered'
  AND delivery_status = '4';