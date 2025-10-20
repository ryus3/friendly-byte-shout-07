-- تصحيح طلبات الاستبدال الموجودة في قاعدة البيانات
-- إصلاح total_amount و sales_amount و discount للطلبات من نوع replacement أو exchange

UPDATE orders 
SET 
  total_amount = 0,
  sales_amount = 0,
  discount = 0,
  updated_at = NOW()
WHERE order_type IN ('replacement', 'exchange')
  AND (total_amount != 0 OR sales_amount != 0 OR discount != 0);