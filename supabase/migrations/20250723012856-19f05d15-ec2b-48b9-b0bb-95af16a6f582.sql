-- حذف الحركة الخاطئة وتحديث الصحيحة
-- حذف حركة الشراء المكررة (نوع purchase)
DELETE FROM public.cash_movements 
WHERE reference_type = 'purchase' 
AND description LIKE 'شراء فاتورة رقم 1%';

-- تحديث وصف الحركة الصحيحة (نوع expense) لتصبح "شراء منتجات"
UPDATE public.cash_movements 
SET description = 'شراء منتجات - فاتورة رقم 1'
WHERE reference_type = 'expense' 
AND description LIKE '%شراء مواد%فاتورة رقم 1%';

-- عرض النتيجة النهائية للتأكد
SELECT 
  cm.description,
  cm.amount,
  cm.reference_type,
  cm.created_at
FROM public.cash_movements cm
WHERE cm.description LIKE '%فاتورة رقم 1%'
ORDER BY cm.created_at;