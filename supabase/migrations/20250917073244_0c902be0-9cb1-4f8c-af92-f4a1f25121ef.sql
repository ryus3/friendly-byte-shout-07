-- حذف دالة cleanup_orphaned_ai_orders من قاعدة البيانات
DROP FUNCTION IF EXISTS public.cleanup_orphaned_ai_orders();

-- تنظيف الإشعارات المكررة القديمة
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