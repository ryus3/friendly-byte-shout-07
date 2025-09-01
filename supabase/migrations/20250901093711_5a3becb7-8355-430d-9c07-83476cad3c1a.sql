-- تنظيف الإشعارات المكررة والقديمة
WITH duplicate_notifications AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY type, message, user_id, 
           (data->>'order_id'), (data->>'delivery_status')
           ORDER BY created_at DESC
         ) as rn
  FROM notifications
),
old_notifications AS (
  SELECT id FROM notifications 
  WHERE created_at < now() - interval '30 days'
  AND type != 'alwaseet_status_change'
)
DELETE FROM notifications 
WHERE id IN (
  SELECT id FROM duplicate_notifications WHERE rn > 1
  UNION
  SELECT id FROM old_notifications
);