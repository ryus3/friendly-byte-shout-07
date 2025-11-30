-- ========================================
-- إصلاح شامل لنظام إشعارات تغيير حالة الطلبات
-- ========================================
-- CRITICAL: هذا النظام كان يعمل بشكل مثالي قبل 25/11
-- الهدف: استعادة الآلية التلقائية لإرسال إشعارات عند تغيير status أو delivery_status

-- ========================================
-- المرحلة 1: تحديث دالة send_order_notifications
-- ========================================
CREATE OR REPLACE FUNCTION public.send_order_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  employee_name TEXT;
  order_creator_name TEXT;
  status_text TEXT;
  old_status_text TEXT;
  status_names JSONB := '{
    "pending": "قيد التجهيز",
    "draft": "مسودة",
    "shipped": "تم الشحن", 
    "delivery": "قيد التوصيل",
    "in_delivery": "قيد التوصيل",
    "delivered": "تم التسليم",
    "completed": "مكتمل",
    "returned": "راجعة",
    "returned_in_stock": "راجع للمخزن",
    "cancelled": "ملغي",
    "partial_delivery": "تسليم جزئي"
  }'::jsonb;
  delivery_status_names JSONB := '{
    "1": "قيد التجهيز",
    "2": "تم الاستلام من التاجر",
    "3": "قيد التوصيل",
    "4": "تم التسليم",
    "5": "ملغي من التاجر",
    "6": "ملغي من الزبون",
    "7": "لم يتم الرد",
    "8": "مؤجل",
    "9": "قيد المراجعة",
    "10": "رقم خاطئ",
    "11": "تم التحويل",
    "12": "خارج التغطية",
    "13": "ملغي مكرر",
    "14": "لم يطلب",
    "15": "مرفوض",
    "16": "راجع جزئي",
    "17": "راجع للمخزن",
    "18": "تغيير سعر",
    "42": "رقم مغلق",
    "43": "طلب استبدال"
  }'::jsonb;
BEGIN
  -- ========================================
  -- عند إنشاء طلب جديد
  -- ========================================
  IF TG_OP = 'INSERT' THEN
    -- جلب اسم منشئ الطلب
    SELECT COALESCE(full_name, business_page_name, 'موظف')
    INTO order_creator_name
    FROM profiles
    WHERE user_id = NEW.created_by;

    -- إشعار للمدير بطلب جديد
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      created_at
    )
    SELECT 
      user_id,
      'new_order',
      'طلب جديد',
      'تم إنشاء طلب جديد #' || NEW.tracking_number || ' بواسطة ' || order_creator_name,
      NEW.id,
      'order',
      NOW()
    FROM profiles
    WHERE role IN ('admin', 'manager');

    RETURN NEW;
  END IF;

  -- ========================================
  -- عند تحديث حالة الطلب
  -- ========================================
  IF TG_OP = 'UPDATE' AND (
    OLD.status IS DISTINCT FROM NEW.status OR 
    OLD.delivery_status IS DISTINCT FROM NEW.delivery_status
  ) THEN
    
    -- جلب أسماء الموظفين
    SELECT COALESCE(full_name, business_page_name, 'موظف')
    INTO employee_name
    FROM profiles
    WHERE user_id = NEW.created_by;

    -- تحديد النص العربي للحالة الجديدة
    IF OLD.delivery_status IS DISTINCT FROM NEW.delivery_status AND NEW.delivery_status IS NOT NULL THEN
      -- أولوية للـ delivery_status إذا تغير
      status_text := COALESCE(
        delivery_status_names->>NEW.delivery_status,
        'حالة غير معروفة (' || NEW.delivery_status || ')'
      );
      old_status_text := COALESCE(
        delivery_status_names->>OLD.delivery_status,
        'حالة غير معروفة'
      );
    ELSE
      -- استخدام status العادي
      status_text := COALESCE(
        status_names->>NEW.status,
        NEW.status
      );
      old_status_text := COALESCE(
        status_names->>OLD.status,
        OLD.status
      );
    END IF;

    -- ========================================
    -- إشعار للمدير بتغيير حالة الطلب
    -- ========================================
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      created_at
    )
    SELECT 
      user_id,
      'order_status_update',
      'تحديث حالة طلب',
      'طلب #' || NEW.tracking_number || ' - ' || employee_name || ': ' || old_status_text || ' ← ' || status_text,
      NEW.id,
      'order',
      NOW()
    FROM profiles
    WHERE role IN ('admin', 'manager');

    -- ========================================
    -- إشعار لمنشئ الطلب بتغيير حالته
    -- ========================================
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        reference_id,
        reference_type,
        created_at
      )
      VALUES (
        NEW.created_by,
        'my_order_status_update',
        'تحديث طلبك',
        'طلب #' || NEW.tracking_number || ': ' || old_status_text || ' ← ' || status_text,
        NEW.id,
        'order',
        NOW()
      );
    END IF;

    -- تسجيل التغيير في جدول order_status_history
    INSERT INTO order_status_history (
      order_id,
      old_status,
      new_status,
      old_delivery_status,
      new_delivery_status,
      changed_at,
      changed_by
    )
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      OLD.delivery_status,
      NEW.delivery_status,
      NOW(),
      NEW.created_by
    );

  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.send_order_notifications() IS 'CRITICAL - يرسل إشعارات تلقائية عند تغيير حالة الطلبات - يعمل عبر trigger على جدول orders';

-- ========================================
-- المرحلة 2: إنشاء Trigger على جدول orders
-- ========================================

-- حذف أي triggers قديمة متعارضة
DROP TRIGGER IF EXISTS trg_send_order_notifications ON orders;
DROP TRIGGER IF EXISTS alwaseet_status_change_trigger ON orders;

-- إنشاء trigger جديد يستدعي send_order_notifications
CREATE TRIGGER trg_send_order_notifications
  AFTER INSERT OR UPDATE OF status, delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_notifications();

COMMENT ON TRIGGER trg_send_order_notifications ON orders IS 'CRITICAL - يُطلق send_order_notifications عند تغيير status أو delivery_status - لا تحذف هذا الـ trigger!';

-- ========================================
-- التحقق النهائي
-- ========================================
-- الآن عند أي تحديث لـ status أو delivery_status، سيتم:
-- ✅ إرسال إشعار للمدير (order_status_update)
-- ✅ إرسال إشعار لمنشئ الطلب (my_order_status_update)
-- ✅ تسجيل التغيير في order_status_history
-- ✅ يعمل تلقائياً من قاعدة البيانات - لا يعتمد على الكود