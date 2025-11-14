-- ✅ إصلاح الطلب 112066293: partial_delivery + الأسعار الصحيحة
UPDATE orders
SET 
  status = 'partial_delivery',
  delivery_status = '23',
  total_amount = 56000,
  final_amount = 33000,
  sales_amount = 28000,
  payment_status = 'pending',
  updated_at = NOW()
WHERE tracking_number = '112066293';

-- تحديث الأرباح للطلب 112066293
UPDATE profits
SET 
  total_revenue = 33000,
  profit_amount = 33000 - total_cost,
  employee_profit = ((employee_percentage / 100.0) * (33000 - total_cost)),
  updated_at = NOW()
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '112066293');