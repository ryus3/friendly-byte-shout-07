-- حذف الدالة القديمة delete_ai_order_safe نهائياً
DROP FUNCTION IF EXISTS public.delete_ai_order_safe(uuid);

-- إضافة دالة تنظيف فوري للطلبات الذكية المتبقية
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_ai_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  deleted_count integer := 0;
BEGIN
  -- حذف جميع الطلبات الذكية التي ليس لديها related_order_id
  DELETE FROM public.ai_orders 
  WHERE related_order_id IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'تم حذف % طلب ذكي متبقي', deleted_count;
  RETURN deleted_count;
END;
$function$;