-- إنشاء دالة تنظيف تلقائي للإشعارات
CREATE OR REPLACE FUNCTION public.auto_cleanup_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- حذف الإشعارات المقروءة الأقدم من شهر
  DELETE FROM notifications 
  WHERE is_read = true 
  AND created_at < now() - interval '30 days'
  AND type != 'alwaseet_status_change'; -- الاحتفاظ بإشعارات الوسيط

  -- حذف الإشعارات المكررة (نفس النوع والرسالة والمستخدم خلال ساعة واحدة)
  WITH duplicate_notifications AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY type, message, user_id, 
             DATE_TRUNC('hour', created_at)
             ORDER BY created_at DESC
           ) as rn
    FROM notifications
    WHERE created_at > now() - interval '7 days'
  )
  DELETE FROM notifications 
  WHERE id IN (
    SELECT id FROM duplicate_notifications WHERE rn > 3
  );

  -- الحد الأقصى للإشعارات لكل مستخدم (100 إشعار)
  WITH ranked_notifications AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id 
             ORDER BY created_at DESC
           ) as rn
    FROM notifications
  )
  DELETE FROM notifications 
  WHERE id IN (
    SELECT id FROM ranked_notifications WHERE rn > 100
  );

  RAISE NOTICE 'تم تنظيف الإشعارات بنجاح';
END;
$function$;