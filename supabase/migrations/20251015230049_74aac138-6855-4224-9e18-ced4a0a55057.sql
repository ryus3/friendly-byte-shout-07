-- تصحيح بيانات الطلب 107647475
UPDATE orders SET
  final_amount = 20000,    -- السعر الأصلي عند الإنشاء
  total_amount = 12000,    -- سعر المنتجات بعد الخصم
  sales_amount = 12000,    -- = total_amount
  discount = 3000,         -- 15000 - 12000
  price_change_type = 'discount',
  updated_at = now()
WHERE tracking_number = '107647475';