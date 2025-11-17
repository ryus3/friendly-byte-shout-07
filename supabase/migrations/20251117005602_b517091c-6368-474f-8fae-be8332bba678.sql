-- ✅ إصلاح الطلب 112066293: تحديث status من 'returned' إلى 'partial_delivery'
-- السبب: الطلب كان في حالة تسليم جزئي (21) ثم تحول إلى (16) راجع للمكتب
-- لكن status تحول خطأً إلى 'returned' بدلاً من الاحتفاظ بـ 'partial_delivery'
UPDATE orders
SET 
  status = 'partial_delivery',
  updated_at = NOW()
WHERE tracking_number = '112066293'
  AND delivery_status = '16'
  AND status = 'returned';

-- ✅ التحقق من النتيجة
SELECT tracking_number, status, delivery_status, total_amount, final_amount
FROM orders
WHERE tracking_number = '112066293';