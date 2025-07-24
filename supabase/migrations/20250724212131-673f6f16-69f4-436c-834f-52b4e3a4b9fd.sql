-- إصلاح الدوال المتبقية النهائية

-- إصلاح auto_calculate_profit_on_receipt
ALTER FUNCTION public.auto_calculate_profit_on_receipt() SET search_path = 'public';

-- إصلاح calculate_purchase_total  
ALTER FUNCTION public.calculate_purchase_total() SET search_path = 'public';

-- إصلاح refresh_main_cash_balance
ALTER FUNCTION public.refresh_main_cash_balance() SET search_path = 'public';

-- إصلاح fix_existing_purchase_shipping
ALTER FUNCTION public.fix_existing_purchase_shipping(uuid, numeric) SET search_path = 'public';

-- إصلاح get_user_by_username
ALTER FUNCTION public.get_user_by_username(text) SET search_path = 'public';

-- إصلاح update_updated_at_column
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';

-- إصلاح username_exists
ALTER FUNCTION public.username_exists(text) SET search_path = 'public';

-- تحديث الشرح
COMMENT ON SCHEMA public IS 'جميع دوال النظام الآن محمية بالكامل';