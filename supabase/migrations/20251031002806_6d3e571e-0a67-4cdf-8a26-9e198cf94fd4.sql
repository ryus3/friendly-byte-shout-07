-- Fix all custom functions to include SET search_path
-- Exclude extension functions (http, urlencode, text_to_bytea which are from extensions)

-- 2. Fix process_telegram_order
ALTER FUNCTION public.process_telegram_order SET search_path = public;

-- 3. Fix rebuild_products_cache 
ALTER FUNCTION public.rebuild_products_cache SET search_path = public;

-- 4. Fix recalculate_order_totals
ALTER FUNCTION public.recalculate_order_totals SET search_path = public;

-- 5. Fix refresh_product_cache_on_change
ALTER FUNCTION public.refresh_product_cache_on_change SET search_path = public;

-- 6. Fix sync_recent_received_invoices
ALTER FUNCTION public.sync_recent_received_invoices SET search_path = public;

-- 7. Fix update_cities_regions_sync_log_timestamp
ALTER FUNCTION public.update_cities_regions_sync_log_timestamp SET search_path = public;

-- 8. Fix update_notification_templates_updated_at
ALTER FUNCTION public.update_notification_templates_updated_at SET search_path = public;

-- 9. Fix validate_order_calculations
ALTER FUNCTION public.validate_order_calculations SET search_path = public;