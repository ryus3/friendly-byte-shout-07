-- إصلاح الطلب 112762972: السعر الأصلي 33,000 (28,000 منتجات + 5,000 توصيل)
-- الشركة أرسلت 31,000 (خصم 2,000 من السعر الأصلي)

-- تعطيل triggers مؤقتاً
SET session_replication_role = 'replica';

-- تصحيح الطلب 112762972
UPDATE orders 
SET 
  total_amount = 26000,      -- سعر المنتجات من الشركة (31,000 - 5,000)
  discount = 2000,           -- الخصم الفعلي من السعر الأصلي (28,000 - 26,000)
  price_increase = 0,        -- لا يوجد زيادة
  price_change_type = 'discount',
  delivery_fee = 5000,
  final_amount = 31000,      -- كما ترسله شركة التوصيل
  sales_amount = 26000       -- سعر المنتجات بعد الخصم
WHERE tracking_number = '112762972';

-- إعادة تفعيل triggers
SET session_replication_role = 'origin';