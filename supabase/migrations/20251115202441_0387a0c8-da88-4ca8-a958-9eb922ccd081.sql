-- ✅ إصلاح الطلبات completed المتضررة
-- إعادة الطلبات التي: delivery_status = '4' + receipt_received = true
UPDATE orders
SET 
  status = 'completed',
  updated_at = NOW()
WHERE 
  delivery_partner = 'alwaseet'
  AND delivery_status = '4'
  AND receipt_received = true
  AND status IN ('delivery', 'delivered', 'shipped', 'pending');