-- دالة تنظيف الإشعارات المكررة (اختيارية)
CREATE OR REPLACE FUNCTION public.cleanup_duplicate_notifications(p_days_back integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count integer := 0;
  duplicate_record record;
BEGIN
  -- حذف الإشعارات المكررة خلال الفترة المحددة
  FOR duplicate_record IN
    WITH ranked_notifications AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (
          PARTITION BY 
            type, 
            (data->>'order_id'), 
            (data->>'state_id'), 
            (data->>'delivery_status')
          ORDER BY created_at DESC, updated_at DESC NULLS LAST
        ) as rn
      FROM public.notifications
      WHERE type IN ('alwaseet_status_change', 'order_status_update')
        AND created_at >= now() - (p_days_back || ' days')::interval
    )
    SELECT id FROM ranked_notifications WHERE rn > 1
  LOOP
    DELETE FROM public.notifications WHERE id = duplicate_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'message', 'تم حذف ' || deleted_count || ' إشعار مكرر من آخر ' || p_days_back || ' أيام'
  );
END;
$function$;