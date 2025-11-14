-- تصحيح البيانات المالية للطلب 112066293
UPDATE orders
SET 
  total_amount = 28000,      -- سعر المنتج M المُسلّم فقط
  final_amount = 33000,      -- 28,000 + 5,000 توصيل
  discount = 0,              -- لا يوجد خصم
  price_change_type = null,  -- إزالة أي علامة خصم
  updated_at = NOW()
WHERE tracking_number = '112066293';