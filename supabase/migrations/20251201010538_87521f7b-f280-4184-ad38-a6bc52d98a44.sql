-- ==========================================
-- إصلاح شامل لنظام إشعارات الطلبات
-- ==========================================

-- 1️⃣ إنشاء دالة تحويل الحالات من رقم إلى نص عربي
CREATE OR REPLACE FUNCTION get_delivery_status_text(status_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE status_id
    WHEN '1' THEN 'بانتظار الاستلام'
    WHEN '2' THEN 'تم استلام الطلب'
    WHEN '4' THEN 'تم التسليم للزبون'
    WHEN '7' THEN 'في الطريق إلى مكتب المحافظة'
    WHEN '17' THEN 'تم الإرجاع للتاجر'
    WHEN '23' THEN 'طلب إلغاء'
    WHEN '25' THEN 'لا يرد - محاولة أولى'
    WHEN '26' THEN 'لا يرد - محاولة ثانية'
    WHEN '27' THEN 'لا يرد - محاولة ثالثة'
    WHEN '32' THEN 'إرجاع جزئي'
    WHEN '42' THEN 'قيد التنفيذ'
    ELSE 'حالة غير معروفة'
  END;
END;
$$;

-- 2️⃣ إضافة UNIQUE constraint للـ UPSERT (فقط لإشعارات تغيير حالة الطلبات)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_order_user_type_unique 
ON notifications (related_entity_id, user_id, type) 
WHERE type = 'order_status_changed';

-- 3️⃣ تعديل دالة send_order_notifications لاستخدام UPSERT وعرض النص العربي
CREATE OR REPLACE FUNCTION send_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tracking_number TEXT;
  v_old_status_text TEXT;
  v_new_status_text TEXT;
BEGIN
  -- الحصول على رقم التتبع
  v_tracking_number := COALESCE(NEW.tracking_number, 'غير متوفر');
  
  -- تحويل الحالات القديمة والجديدة إلى نص عربي
  v_old_status_text := get_delivery_status_text(COALESCE(OLD.delivery_status, ''));
  v_new_status_text := get_delivery_status_text(COALESCE(NEW.delivery_status, ''));
  
  -- إرسال إشعار فقط إذا تغيرت حالة التوصيل
  IF (OLD.delivery_status IS DISTINCT FROM NEW.delivery_status) THEN
    -- استخدام UPSERT لتحديث الإشعار الموجود بدلاً من إنشاء إشعار جديد
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      related_entity_id,
      is_read,
      created_at,
      updated_at
    )
    VALUES (
      NEW.created_by,
      'order_status_changed',
      'تحديث حالة الطلب',
      v_new_status_text || ' ' || v_tracking_number,
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', v_tracking_number,
        'old_status', OLD.delivery_status,
        'new_status', NEW.delivery_status,
        'old_status_text', v_old_status_text,
        'new_status_text', v_new_status_text
      ),
      NEW.id,
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (related_entity_id, user_id, type) 
    WHERE type = 'order_status_changed'
    DO UPDATE SET
      message = EXCLUDED.message,
      data = EXCLUDED.data,
      updated_at = NOW(),
      is_read = false;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION get_delivery_status_text IS 'تحويل رقم حالة التوصيل إلى نص عربي';
COMMENT ON FUNCTION send_order_notifications IS 'إرسال/تحديث إشعارات تغيير حالة الطلبات مع UPSERT لمنع التكرار';