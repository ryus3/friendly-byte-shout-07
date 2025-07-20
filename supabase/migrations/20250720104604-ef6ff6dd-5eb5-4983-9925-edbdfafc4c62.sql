-- إصلاح النظام المالي - إضافة القيود المطلوبة وإنشاء النظام التلقائي

-- 1. إضافة قيد unique على order_id في جدول الأرباح
ALTER TABLE public.profits 
ADD CONSTRAINT profits_order_id_unique UNIQUE (order_id);

-- 2. تنظيف البيانات المكررة أولاً
DELETE FROM public.profits p1 
WHERE EXISTS (
  SELECT 1 FROM public.profits p2 
  WHERE p2.order_id = p1.order_id 
  AND p2.id > p1.id
);

-- 3. تنظيف حركات النقد الخاطئة
DELETE FROM public.cash_movements 
WHERE reference_type = 'realized_profit' 
AND cash_source_id = (SELECT id FROM public.cash_sources WHERE name = 'القاصة الرئيسية');

-- 4. إعادة تعيين رصيد القاصة الرئيسية لرأس المال فقط
UPDATE public.cash_sources 
SET current_balance = initial_balance,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- 5. حذف سجلات الأرباح الموجودة لإعادة إنشائها بالطريقة الصحيحة
DELETE FROM public.profits;