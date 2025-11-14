-- المرحلة 1: تحديث قيد الحالات لإصلاح المزامنة (CRITICAL)
-- حذف القيد القديم الذي يمنع تحديث الحالات
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- إضافة قيد جديد يشمل جميع الحالات المطلوبة
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'processing'::text,
  'delivered'::text,
  'returned'::text,
  'returned_in_stock'::text,    -- ✅ إضافة - لحالة 17
  'cancelled'::text,
  'partial_delivery'::text,
  'completed'::text,             -- ✅ إضافة - للمستقبل
  'shipped'::text,               -- ✅ إضافة - للمستقبل
  'delivery'::text               -- ✅ إضافة - للمستقبل
]));

-- المرحلة 2: إصلاح بيانات الطلب 112066293
-- تصحيح المبلغ النهائي ليعكس تسليم منتج واحد فقط
UPDATE orders
SET 
  final_amount = 33000,          -- منتج واحد (28,000) + توصيل (5,000)
  updated_at = NOW()
WHERE tracking_number = '112066293';

-- تحديث الأرباح لتعكس البيع الفعلي
UPDATE profits
SET 
  total_revenue = 33000,         -- الإيراد الفعلي من منتج واحد
  profit_amount = 15500,         -- 33,000 - 17,500 (تكلفة منتج واحد)
  updated_at = NOW()
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '112066293');