-- تصحيح التناقض في النظام المالي
-- المشكلة: المصروف موجود في جدول expenses لكن حركة النقد محذوفة

-- أولاً: نحدث المصروف ليصبح اسمه "شراء منتجات" بدلاً من "شراء مواد"
UPDATE public.expenses 
SET description = 'شراء منتجات - فاتورة رقم 1 من تجريبي'
WHERE id = '0bfdb30b-5227-4cf0-9fc1-c9d15948365d'
AND description = 'شراء مواد - فاتورة رقم 1 من تجريبي';

-- التحقق من التطابق بين الجدولين
SELECT 
  'expenses' as source,
  id,
  description,
  amount,
  status
FROM public.expenses 
WHERE receipt_number = '1'

UNION ALL

SELECT 
  'cash_movements' as source,
  cm.id,
  cm.description,
  cm.amount,
  'N/A' as status
FROM public.cash_movements cm
WHERE cm.description LIKE '%فاتورة رقم 1%'
ORDER BY source, description;