-- تحديث الطلب 107432932
UPDATE orders 
SET 
  total_amount = 19000,
  sales_amount = 14000,
  delivery_fee = 5000,
  discount = 7000,
  updated_at = now()
WHERE tracking_number = '107432932';

-- تحديث الطلب 107595994
UPDATE orders 
SET 
  total_amount = 40000,
  sales_amount = 35000,
  delivery_fee = 5000,
  discount = 15000,
  updated_at = now()
WHERE tracking_number = '107595994';

-- تحديث الأرباح للطلب 107432932
UPDATE profits
SET 
  total_revenue = 19000,
  profit_amount = (14000 - total_cost),
  employee_profit = ((14000 - total_cost) * employee_percentage / 100),
  updated_at = now()
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '107432932');

-- تحديث الأرباح للطلب 107595994
UPDATE profits
SET 
  total_revenue = 40000,
  profit_amount = (35000 - total_cost),
  employee_profit = ((35000 - total_cost) * employee_percentage / 100),
  updated_at = now()
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '107595994');