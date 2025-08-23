-- إصلاح نظام الإشعارات: منع التكرار وإصلاح النصوص (نسخة منقحة بدون استخدام now() في فهرس فريد)

-- 1) حذف الإشعارات المكررة من آخر 24 ساعة (نحتفظ بأحدث سجل لكل (order_id,new_status))
DELETE FROM notifications 
WHERE type = 'order_status_changed' 
AND created_at > now() - interval '24 hours'
AND id NOT IN (
  SELECT DISTINCT ON (data->>'order_id', data->>'new_status') id
  FROM notifications 
  WHERE type = 'order_status_changed' 
  AND created_at > now() - interval '24 hours'
  ORDER BY data->>'order_id', data->>'new_status', created_at DESC
);

-- 2) وظيفة التريغر: إشعار فقط عند تغير delivery_status فعلياً مع منع التكرار عبر فاصل 5 دقائق
CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.delivery_status IS DISTINCT FROM NEW.delivery_status THEN
    -- عدم إنشاء سجل مكرر خلال 5 دقائق لنفس الطلب والحالة
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE type = 'order_status_changed'
        AND data->>'order_id' = NEW.id::text
        AND data->>'new_status' = NEW.delivery_status
        AND created_at > now() - interval '5 minutes'
    ) THEN
      INSERT INTO public.notifications (
        title, message, type, priority, data, user_id
      ) VALUES (
        'تحديث حالة الطلب',
        COALESCE(NEW.tracking_number::text, NEW.order_number) || ' ' || COALESCE(NEW.delivery_status, 'تحديث حالة'),
        'order_status_changed',
        CASE 
          WHEN NEW.delivery_status ILIKE '%delivered%' OR NEW.delivery_status ILIKE '%تم التسليم%' THEN 'high'
          WHEN NEW.delivery_status ILIKE '%out for delivery%' OR NEW.delivery_status ILIKE '%في الطريق%' THEN 'medium'
          ELSE 'low'
        END,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'old_status', OLD.delivery_status,
          'new_status', NEW.delivery_status,
          'customer_name', NEW.customer_name,
          'delivery_partner', NEW.delivery_partner
        ),
        NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) ربط التريغر بجدول الطلبات
DROP TRIGGER IF EXISTS alwaseet_status_change_trigger ON public.orders;
CREATE TRIGGER alwaseet_status_change_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_alwaseet_status_change();

-- 4) فهارس لتحسين الأداء لعمليات منع التكرار وعرض الإشعارات
CREATE INDEX IF NOT EXISTS idx_notifications_type_order_time 
  ON public.notifications(type, ((data->>'order_id')), created_at DESC);

-- 5) فهرس فريد دائم لمنع تكرار نفس (order_id,new_status) لنوع order_status_changed (بدون شرط زمني)
-- هذا يضمن إشعاراً واحداً لكل حالة لكل طلب، وهو السلوك المطلوب (إشعار فقط عند التغيير)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_order_status_per_type 
  ON public.notifications(type, ((data->>'order_id')), ((data->>'new_status'))) 
  WHERE type = 'order_status_changed';