-- إصلاح الطلب 2616423 الذي لم يحسب الخصم بسبب تحديث السعر قبل الإصلاح
UPDATE orders 
SET 
  discount = 3000,
  price_increase = 0,
  price_change_type = 'discount',
  updated_at = NOW()
WHERE tracking_number = '2616423';