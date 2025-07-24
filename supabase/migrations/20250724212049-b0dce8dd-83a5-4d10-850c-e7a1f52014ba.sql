-- إصلاح جميع الدوال المتبقية - الجزء النهائي

-- إصلاح generate_product_barcode
ALTER FUNCTION public.generate_product_barcode(text, text, text, uuid) SET search_path = 'public';

-- إصلاح is_admin_or_deputy
ALTER FUNCTION public.is_admin_or_deputy() SET search_path = 'public';

-- إصلاح auto_generate_product_barcode
ALTER FUNCTION public.auto_generate_product_barcode() SET search_path = 'public';

-- إصلاح auto_generate_variant_barcode
ALTER FUNCTION public.auto_generate_variant_barcode() SET search_path = 'public';

-- إصلاح auto_generate_variant_qrcode
ALTER FUNCTION public.auto_generate_variant_qrcode() SET search_path = 'public';

-- إصلاح set_order_number
ALTER FUNCTION public.set_order_number() SET search_path = 'public';

-- إصلاح simple_generate_barcode
ALTER FUNCTION public.simple_generate_barcode() SET search_path = 'public';

-- إصلاح generate_product_qrcode
ALTER FUNCTION public.generate_product_qrcode(text, text, text, uuid, uuid) SET search_path = 'public';

-- إصلاح auto_generate_product_qrcode
ALTER FUNCTION public.auto_generate_product_qrcode() SET search_path = 'public';

-- إصلاح auto_generate_purchase_number
ALTER FUNCTION public.auto_generate_purchase_number() SET search_path = 'public';

-- إصلاح set_purchase_number
ALTER FUNCTION public.set_purchase_number() SET search_path = 'public';

-- إصلاح generate_purchase_number
ALTER FUNCTION public.generate_purchase_number() SET search_path = 'public';

-- إصلاح update_main_cash_on_capital_change
ALTER FUNCTION public.update_main_cash_on_capital_change() SET search_path = 'public';

-- إصلاح generate_order_number
ALTER FUNCTION public.generate_order_number() SET search_path = 'public';

-- إصلاح get_user_highest_role
ALTER FUNCTION public.get_user_highest_role(uuid) SET search_path = 'public';

-- إصلاح get_user_product_access
ALTER FUNCTION public.get_user_product_access(uuid, text) SET search_path = 'public';

-- إصلاح check_user_variant_permission
ALTER FUNCTION public.check_user_variant_permission(uuid, text, uuid) SET search_path = 'public';

-- إصلاح filter_products_by_permissions
ALTER FUNCTION public.filter_products_by_permissions(uuid) SET search_path = 'public';

-- إصلاح update_reserved_stock
ALTER FUNCTION public.update_reserved_stock(uuid, integer, text) SET search_path = 'public';

-- إصلاح finalize_stock_item
ALTER FUNCTION public.finalize_stock_item(uuid, uuid, integer) SET search_path = 'public';

-- إصلاح release_stock_item
ALTER FUNCTION public.release_stock_item(uuid, uuid, integer) SET search_path = 'public';

-- إصلاح get_available_stock
ALTER FUNCTION public.get_available_stock(uuid, uuid) SET search_path = 'public';

-- إصلاح update_cash_source_balance
ALTER FUNCTION public.update_cash_source_balance(uuid, numeric, text, text, uuid, text, uuid) SET search_path = 'public';

-- إصلاح update_variant_stock_from_purchase
ALTER FUNCTION public.update_variant_stock_from_purchase(text, integer, numeric) SET search_path = 'public';

-- إصلاح update_variant_stock_from_purchase_with_cost
ALTER FUNCTION public.update_variant_stock_from_purchase_with_cost(text, integer, numeric, uuid, timestamp with time zone) SET search_path = 'public';

-- إصلاح calculate_fifo_cost
ALTER FUNCTION public.calculate_fifo_cost(uuid, uuid, integer) SET search_path = 'public';

-- إصلاح add_purchase_cost_record
ALTER FUNCTION public.add_purchase_cost_record(uuid, uuid, uuid, integer, numeric, timestamp with time zone) SET search_path = 'public';

-- إصلاح delete_purchase_completely
ALTER FUNCTION public.delete_purchase_completely(uuid) SET search_path = 'public';

-- إصلاح cleanup_deleted_purchases
ALTER FUNCTION public.cleanup_deleted_purchases() SET search_path = 'public';

-- إصلاح auth_with_username
ALTER FUNCTION public.auth_with_username(text, text) SET search_path = 'public';

-- إصلاح handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';

-- إصلاح auto_generate_telegram_code
ALTER FUNCTION public.auto_generate_telegram_code() SET search_path = 'public';

-- إصلاح get_employee_by_telegram_id
ALTER FUNCTION public.get_employee_by_telegram_id(bigint) SET search_path = 'public';

-- إصلاح generate_telegram_code
ALTER FUNCTION public.generate_telegram_code(uuid, text) SET search_path = 'public';

-- إصلاح generate_employee_telegram_code
ALTER FUNCTION public.generate_employee_telegram_code(uuid) SET search_path = 'public';

-- إصلاح process_telegram_order
ALTER FUNCTION public.process_telegram_order(jsonb, text, text, text, numeric, jsonb, bigint, text) SET search_path = 'public';

-- إصلاح link_telegram_user
ALTER FUNCTION public.link_telegram_user(text, bigint) SET search_path = 'public';

-- تحديث تصنيف الأمان لجميع الدوال
COMMENT ON SCHEMA public IS 'جميع دوال النظام محمية بـ search_path آمن';