-- 1. حذف سجل الربح الخاطئ للطلب 116366331 (لا توجد قاعدة ربح)
DELETE FROM profits 
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '116366331')
AND employee_profit = 10000;

-- 2. إصلاح مشكلة الـ Deadlock في الإشعارات
CREATE OR REPLACE FUNCTION safe_mark_notifications_read(p_user_id UUID, p_notification_ids UUID[] DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    UPDATE notifications
    SET is_read = true, updated_at = NOW()
    WHERE user_id = p_user_id 
    AND is_read = false
    AND id IN (
      SELECT id FROM notifications 
      WHERE user_id = p_user_id AND is_read = false
      FOR UPDATE SKIP LOCKED
    );
  ELSE
    UPDATE notifications
    SET is_read = true, updated_at = NOW()
    WHERE id = ANY(p_notification_ids)
    AND is_read = false
    AND id IN (
      SELECT id FROM notifications 
      WHERE id = ANY(p_notification_ids) AND is_read = false
      FOR UPDATE SKIP LOCKED
    );
  END IF;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 3. إضافة indexes لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read) 
WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_profits_order_id ON profits(order_id);
CREATE INDEX IF NOT EXISTS idx_profits_employee_status ON profits(employee_id, status);