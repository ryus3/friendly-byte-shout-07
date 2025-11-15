-- إصلاح شامل للحالات - تطبيق التعديلات الجديدة للحالات الـ 44

-- 1. إصلاح الطلبات delivery_status = 4 (تم التسليم)
UPDATE orders
SET status = 'delivered', updated_at = NOW()
WHERE delivery_status = '4' 
  AND status NOT IN ('delivered', 'completed', 'partial_delivery', 'returned_in_stock');

-- 2. إصلاح الطلبات delivery_status في حالات delivery (17 حالة)
UPDATE orders
SET status = 'delivery', updated_at = NOW()
WHERE delivery_status IN (
  '3','18','22','24','25','26','27','28','29','30','33',
  '34','35','36','37','38','39','40','41','42','43','44'
) 
AND status NOT IN ('completed', 'partial_delivery', 'returned_in_stock');

-- 3. إصلاح الطلبات المرجعة (9 حالات)
UPDATE orders
SET status = 'returned', updated_at = NOW()
WHERE delivery_status IN ('12','13','15','16','19','20','23','31','32') 
AND status NOT IN ('completed', 'partial_delivery', 'returned_in_stock');

-- 4. الحالة 17 → returned_in_stock (نهائية)
UPDATE orders
SET status = 'returned_in_stock', updated_at = NOW()
WHERE delivery_status = '17' 
AND status != 'returned_in_stock';