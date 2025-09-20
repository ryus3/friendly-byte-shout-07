-- إصلاح البيانات الفعلية - المرحلة الثانية
-- 1. تصفير رصيد قاصة الأعظمية (المفروض تكون 0 لأنها لا تحتوي على حركات)
UPDATE public.cash_sources 
SET current_balance = 0.00,
    updated_at = now()
WHERE name = 'قاصة الاعظمية';

-- 2. تصحيح حركة النقد للطلب ORD000010 في القاصة الرئيسية
-- المشكلة: balance_before = 0 و balance_after = 21000
-- المفروض: balance_before = 5164000 و balance_after = 5185000
UPDATE public.cash_movements 
SET balance_before = 5164000.00,
    balance_after = 5185000.00,
    updated_at = now()
WHERE id = 'aac2f621-bea8-46ae-bea6-0aeb184723fa' 
  AND description = 'إيراد من الطلب ORD000010';

-- 3. التأكد من أن رصيد القاصة الرئيسية يطابق آخر حركة (5185000)
UPDATE public.cash_sources 
SET current_balance = 5185000.00,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 4. التحقق من النتيجة
SELECT 'تم الإصلاح بنجاح' as status;