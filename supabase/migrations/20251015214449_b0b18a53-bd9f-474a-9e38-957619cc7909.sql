-- إصلاح الطلب 107647475 يدوياً
UPDATE orders 
SET 
  final_amount = 20000,   -- السعر الأصلي (ثابت)
  total_amount = 17000,   -- السعر الحالي من AlWaseet
  sales_amount = 12000,   -- 17000 - 5000
  discount = 3000,        -- 20000 - 17000 (خصم موجب)
  updated_at = now()
WHERE tracking_number = '107647475';

-- تحديث الأرباح
UPDATE profits 
SET 
  total_revenue = 17000,
  profit_amount = 12000 - total_cost,
  employee_profit = ((12000 - total_cost) * employee_percentage / 100.0),
  updated_at = now()
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '107647475');