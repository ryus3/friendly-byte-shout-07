-- إصلاح دالة send_order_notifications لاستخدام نظام الأدوار الصحيح
-- المشكلة: كانت تبحث عن p.role في جدول profiles (غير موجود)
-- الحل: استخدام user_roles + roles

CREATE OR REPLACE FUNCTION send_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_creator_name TEXT;
  v_tracking_number TEXT;
  v_old_status TEXT;
  v_new_status TEXT;
  v_old_delivery_status TEXT;
  v_new_delivery_status TEXT;
  v_status_changed BOOLEAN := FALSE;
  v_delivery_status_changed BOOLEAN := FALSE;
BEGIN
  -- جلب معلومات الطلب
  SELECT created_by, tracking_number
  INTO v_creator_id, v_tracking_number
  FROM orders
  WHERE id = NEW.id;

  -- جلب اسم المنشئ
  SELECT full_name INTO v_creator_name
  FROM profiles
  WHERE user_id = v_creator_id;

  -- تتبع التغييرات
  v_old_status := OLD.status;
  v_new_status := NEW.status;
  v_old_delivery_status := OLD.delivery_status;
  v_new_delivery_status := NEW.delivery_status;

  -- التحقق من تغيير الحالة
  IF v_old_status IS DISTINCT FROM v_new_status THEN
    v_status_changed := TRUE;
  END IF;

  IF v_old_delivery_status IS DISTINCT FROM v_new_delivery_status THEN
    v_delivery_status_changed := TRUE;
  END IF;

  -- إرسال الإشعارات فقط إذا حدث تغيير
  IF v_status_changed OR v_delivery_status_changed THEN
    -- إشعار للمنشئ
    INSERT INTO notifications (
      type,
      title,
      message,
      user_id,
      data,
      priority,
      is_read,
      related_entity_id,
      created_at
    )
    VALUES (
      'order_status_changed',
      '🔄 تحديث حالة الطلب',
      CASE 
        WHEN v_status_changed AND v_delivery_status_changed THEN
          'تم تحديث حالة الطلب ' || v_tracking_number || ' من "' || COALESCE(v_old_status, 'غير محدد') || '" إلى "' || v_new_status || '" وحالة التوصيل من "' || COALESCE(v_old_delivery_status, 'غير محدد') || '" إلى "' || v_new_delivery_status || '"'
        WHEN v_status_changed THEN
          'تم تحديث حالة الطلب ' || v_tracking_number || ' من "' || COALESCE(v_old_status, 'غير محدد') || '" إلى "' || v_new_status || '"'
        ELSE
          'تم تحديث حالة التوصيل للطلب ' || v_tracking_number || ' من "' || COALESCE(v_old_delivery_status, 'غير محدد') || '" إلى "' || v_new_delivery_status || '"'
      END,
      v_creator_id,
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', v_tracking_number,
        'old_status', v_old_status,
        'new_status', v_new_status,
        'old_delivery_status', v_old_delivery_status,
        'new_delivery_status', v_new_delivery_status,
        'reference_type', 'order'
      ),
      'medium',
      false,
      NEW.id,
      NOW()
    );

    -- إشعار للمديرين والمساعدين (استخدام نظام الأدوار الصحيح)
    INSERT INTO notifications (
      type,
      title,
      message,
      user_id,
      data,
      priority,
      is_read,
      related_entity_id,
      created_at
    )
    SELECT
      'order_status_changed',
      '🔄 تحديث حالة طلب من ' || COALESCE(v_creator_name, 'موظف'),
      CASE 
        WHEN v_status_changed AND v_delivery_status_changed THEN
          'الطلب ' || v_tracking_number || ': تغيرت الحالة من "' || COALESCE(v_old_status, 'غير محدد') || '" إلى "' || v_new_status || '" وحالة التوصيل من "' || COALESCE(v_old_delivery_status, 'غير محدد') || '" إلى "' || v_new_delivery_status || '"'
        WHEN v_status_changed THEN
          'الطلب ' || v_tracking_number || ': تغيرت الحالة من "' || COALESCE(v_old_status, 'غير محدد') || '" إلى "' || v_new_status || '"'
        ELSE
          'الطلب ' || v_tracking_number || ': تغيرت حالة التوصيل من "' || COALESCE(v_old_delivery_status, 'غير محدد') || '" إلى "' || v_new_delivery_status || '"'
      END,
      p.user_id,
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', v_tracking_number,
        'creator_name', v_creator_name,
        'created_by', v_creator_id,
        'old_status', v_old_status,
        'new_status', v_new_status,
        'old_delivery_status', v_old_delivery_status,
        'new_delivery_status', v_new_delivery_status,
        'reference_type', 'order'
      ),
      'medium',
      false,
      NEW.id,
      NOW()
    FROM profiles p
    INNER JOIN user_roles ur ON p.user_id = ur.user_id
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE r.name IN ('super_admin', 'admin', 'manager', 'deputy_manager')
      AND ur.is_active = true
      AND p.user_id != v_creator_id;  -- عدم إرسال للمنشئ مرتين
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION send_order_notifications() IS 'يرسل إشعارات تلقائية عند تغيير حالة الطلب. تم إصلاحها لاستخدام نظام الأدوار الصحيح (user_roles + roles) بدلاً من profiles.role غير الموجود.';