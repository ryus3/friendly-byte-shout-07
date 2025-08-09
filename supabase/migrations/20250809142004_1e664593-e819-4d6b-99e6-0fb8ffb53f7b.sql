-- Harden function search_path for security (fix linter warnings)
ALTER FUNCTION public.auto_add_delivery_cost() SET search_path TO public;
ALTER FUNCTION public.auto_update_phone_customer_tier() SET search_path TO public;
ALTER FUNCTION public.handle_order_status_change() SET search_path TO public;
ALTER FUNCTION public.update_city_order_stats() SET search_path TO public;
ALTER FUNCTION public.update_customer_tier_by_phone(text) SET search_path TO public;

-- Indexes to support retention cleanups and speed up queries
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_stock_notification_history_created_at ON public.stock_notification_history (created_at);

-- Cleanup old notifications (default 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications(p_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old notifications older than % days', deleted_count, p_days;
  RETURN deleted_count;
END;
$$;

-- Cleanup stock notification history (default 180 days)
CREATE OR REPLACE FUNCTION public.cleanup_stock_notification_history(p_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  DELETE FROM public.stock_notification_history
  WHERE created_at < now() - (p_days || ' days')::interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % old stock notifications older than % days', deleted_count, p_days;
  RETURN deleted_count;
END;
$$;

-- Single entry point for maintenance (can be scheduled)
CREATE OR REPLACE FUNCTION public.run_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  notif_del integer;
  stock_del integer;
BEGIN
  notif_del := public.cleanup_old_notifications(90);
  stock_del := public.cleanup_stock_notification_history(180);
  PERFORM public.cleanup_old_backups();
  RETURN jsonb_build_object(
    'notifications_deleted', notif_del,
    'stock_history_deleted', stock_del,
    'backups_cleanup', true,
    'ran_at', now()
  );
END;
$$;