-- إصلاح نظام التسليم الجزئي: تصحيح البيانات الخاطئة

-- 1️⃣ تصحيح final_amount للطلب 112066293
-- السعر الصحيح: منتج واحد 28000 + توصيل 5000 = 33000
UPDATE orders 
SET 
  final_amount = 33000,
  discount = 23000,  -- الفرق من الطلب الأصلي (56000 - 33000)
  updated_at = now()
WHERE delivery_partner_order_id = '112066293'
  AND order_type = 'partial_delivery';

-- 2️⃣ تصحيح status للطلبين من 'returned' إلى 'delivery'
-- الطلبات partial_delivery يجب ألا تتحول إلى 'returned' أبداً
UPDATE orders 
SET 
  status = 'delivery',
  updated_at = now()
WHERE delivery_partner_order_id IN ('112552848', '112066293')
  AND order_type = 'partial_delivery'
  AND status = 'returned';