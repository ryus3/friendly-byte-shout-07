-- حذف الإشعارات المتكررة لطلبات التحاسب
-- الاحتفاظ بالإشعار الذي يحتوي على أكبر عدد من الطلبات لكل موظف

WITH ranked_notifications AS (
  SELECT 
    id,
    data->>'employee_id' as emp_id,
    COALESCE(jsonb_array_length(data->'order_ids'), 0) as order_count,
    ROW_NUMBER() OVER (
      PARTITION BY data->>'employee_id' 
      ORDER BY COALESCE(jsonb_array_length(data->'order_ids'), 0) DESC, created_at ASC
    ) as rn
  FROM notifications
  WHERE type = 'settlement_request' AND is_read = false
)
DELETE FROM notifications 
WHERE id IN (SELECT id FROM ranked_notifications WHERE rn > 1);