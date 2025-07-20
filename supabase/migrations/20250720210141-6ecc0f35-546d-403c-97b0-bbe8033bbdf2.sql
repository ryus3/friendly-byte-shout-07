-- حذف جميع الدوال والتريغيرز المتعلقة بالنظام المحاسبي والمالي

-- حذف التريغيرز
DROP TRIGGER IF EXISTS trigger_calculate_profit_on_receipt ON orders;

-- حذف الدوال المالية والمحاسبية
DROP FUNCTION IF EXISTS public.update_cash_source_balance(uuid, numeric, text, text, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.calculate_order_profit(uuid);
DROP FUNCTION IF EXISTS public.calculate_order_profit_fixed_amounts(uuid);
DROP FUNCTION IF EXISTS public.calculate_net_capital();
DROP FUNCTION IF EXISTS public.trigger_calculate_profit_on_receipt();
DROP FUNCTION IF EXISTS public.get_actual_cash_balance();
DROP FUNCTION IF EXISTS public.get_total_cash_balance();
DROP FUNCTION IF EXISTS public.handle_manual_cash_addition(uuid, numeric, text, uuid);

-- حذف أي دوال أخرى متعلقة بالحسابات المالية
DROP FUNCTION IF EXISTS public.calculate_employee_item_profit(uuid, uuid, uuid, integer, numeric);
DROP FUNCTION IF EXISTS public.create_auto_settlement_request(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.update_settlement_status(uuid, text, uuid, text, numeric);

-- حذف جدول الأرباح إذا كان موجود (سنحسب الأرباح في الواجهة)
-- DROP TABLE IF EXISTS public.profits CASCADE;

-- تنظيف أي بيانات قديمة متعلقة بالحسابات المعقدة
-- يمكن الاحتفاظ بالجداول الأساسية ولكن إزالة الاعتماد على الدوال

COMMENT ON SCHEMA public IS 'النظام المحاسبي الآن يعتمد على حسابات الواجهة الأمامية فقط - لا توجد دوال معقدة';