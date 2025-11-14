
-- ✅ إصلاح الطلب 112066282: الحالة 23 = processing (بدلاً من delivery لأن constraint لا يسمح بـ delivery)
UPDATE orders
SET 
  status = 'processing',
  delivery_status = '23',
  payment_status = 'pending',
  updated_at = NOW()
WHERE tracking_number = '112066282';

-- ✅ إصلاح الطلب 112066293: الحالة 23 = processing + السعر الصحيح
UPDATE orders
SET 
  status = 'processing',
  delivery_status = '23',
  total_amount = 28000,
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
