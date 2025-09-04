-- إنشاء دالة التنظيف اليومي المحسنة
CREATE OR REPLACE FUNCTION public.daily_notifications_cleanup()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  total_deleted INTEGER := 0;
  duplicates_cleaned INTEGER := 0;
  old_cleaned INTEGER := 0;
BEGIN
  -- تنظيف الإشعارات القديمة (أكبر من 10 أيام)
  WITH deleted_old AS (
    DELETE FROM notifications 
    WHERE is_read = true 
    AND created_at < now() - interval '10 days'
    AND type != 'alwaseet_status_change'
    RETURNING id
  )
  SELECT COUNT(*) INTO old_cleaned FROM deleted_old;

  -- تنظيف المكررات
  WITH duplicate_notifications AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY type, message, user_id, 
             DATE_TRUNC('hour', created_at)
             ORDER BY created_at DESC
           ) as rn
    FROM notifications
    WHERE created_at > now() - interval '7 days'
  ),
  deleted_duplicates AS (
    DELETE FROM notifications 
    WHERE id IN (
      SELECT id FROM duplicate_notifications WHERE rn > 3
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO duplicates_cleaned FROM deleted_duplicates;

  -- تطبيق الحد الأقصى (100 لكل مستخدم)
  WITH ranked_notifications AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id 
             ORDER BY created_at DESC
           ) as rn
    FROM notifications
  ),
  deleted_excess AS (
    DELETE FROM notifications 
    WHERE id IN (
      SELECT id FROM ranked_notifications WHERE rn > 100
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO total_deleted FROM deleted_excess;

  total_deleted := old_cleaned + duplicates_cleaned + total_deleted;

  RETURN jsonb_build_object(
    'success', true,
    'total_deleted', total_deleted,
    'old_notifications_cleaned', old_cleaned,
    'duplicates_cleaned', duplicates_cleaned,
    'cleanup_date', now(),
    'message', 'تم تنظيف ' || total_deleted || ' إشعار بنجاح'
  );
END;
$function$;