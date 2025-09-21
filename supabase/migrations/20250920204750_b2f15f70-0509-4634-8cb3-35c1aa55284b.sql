-- إصلاح البيانات الفعلية - بدون updated_at للحركات
-- 1. تصفير رصيد قاصة الأعظمية
UPDATE public.cash_sources 
SET current_balance = 0.00,
    updated_at = now()
WHERE name = 'قاصة الاعظمية';

-- 2. تصحيح حركة النقد للطلب ORD000010
UPDATE public.cash_movements 
SET balance_before = 5164000.00,
    balance_after = 5185000.00
WHERE id = 'aac2f621-bea8-46ae-bea6-0aeb184723fa'::uuid;

-- 3. التأكد من رصيد القاصة الرئيسية
UPDATE public.cash_sources 
SET current_balance = 5185000.00,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 4. التحقق من النتيجة
SELECT 
  cs.name,
  cs.current_balance,
  'إصلاح مكتمل' as status
FROM public.cash_sources cs 
WHERE cs.is_active = true
ORDER BY cs.name;