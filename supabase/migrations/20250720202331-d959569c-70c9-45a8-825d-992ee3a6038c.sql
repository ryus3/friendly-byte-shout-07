-- تبسيط نظام القاصة الرئيسية: حذف الدوال المعقدة

-- 1. حذف دالة recalculate_main_cash_balance لأننا سنحسبها في الواجهة
DROP FUNCTION IF EXISTS public.recalculate_main_cash_balance();

-- 2. حذف trigger المصاريف المكرر
DROP TRIGGER IF EXISTS trigger_handle_approved_expense ON public.expenses;
DROP FUNCTION IF EXISTS public.handle_approved_expense();

-- 3. حذف trigger حساب الأرباح التلقائي (سنستخدم useUnifiedProfits بدلاً منه)
DROP TRIGGER IF EXISTS process_order_profit_to_cash_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.process_order_profit_to_cash();

-- 4. تنظيف حركات النقد المكررة
DELETE FROM public.cash_movements 
WHERE reference_type = 'initial_capital' 
AND description LIKE '%رأس المال المُحدّث%';

-- 5. إضافة رأس المال في جدول الإعدادات إذا لم يكن موجوداً
INSERT INTO public.settings (key, value, description)
VALUES ('initial_capital', '0', 'رأس المال الأساسي للشركة')
ON CONFLICT (key) DO NOTHING;