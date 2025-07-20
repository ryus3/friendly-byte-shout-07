-- حذف جميع البيانات المالية من قاعدة البيانات لجعل النظام 100% في الواجهة

-- 1. حذف رأس المال من جدول الإعدادات
DELETE FROM public.settings WHERE key IN ('initial_capital', 'capital', 'main_cash_balance');

-- 2. حذف جميع حركات النقد المتعلقة برأس المال
DELETE FROM public.cash_movements WHERE reference_type IN ('initial_capital', 'capital_injection', 'capital_withdrawal');

-- 3. إزالة أي دوال قد تكون باقية متعلقة بالحسابات
DROP FUNCTION IF EXISTS public.get_main_cash_balance();
DROP FUNCTION IF EXISTS public.calculate_main_balance();
DROP FUNCTION IF EXISTS public.get_capital_balance();
DROP FUNCTION IF EXISTS public.update_main_cash_balance();

-- 4. حذف أي جداول متعلقة بالأرباح القديمة إذا كانت موجودة
DROP TABLE IF EXISTS public.profit_calculations CASCADE;
DROP TABLE IF EXISTS public.financial_summaries CASCADE;

-- 5. تنظيف القاصة الرئيسية لتصبح بدون رصيد في قاعدة البيانات
UPDATE public.cash_sources 
SET current_balance = 0, initial_balance = 0 
WHERE name = 'القاصة الرئيسية';

COMMENT ON SCHEMA public IS 'النظام المالي الآن يعتمد 100% على حسابات الواجهة الأمامية - لا توجد بيانات مالية في قاعدة البيانات';