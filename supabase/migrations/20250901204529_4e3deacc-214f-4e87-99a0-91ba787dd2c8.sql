-- إصلاح نظام إشعارات الوسيط - صيغة رقم التتبع + الحالة وألوان محددة

-- تحديث دالة إشعارات الوسيط لتحسين الصيغة والألوان
CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  existing_notification_id uuid;
  msg_number text;
  status_code text;
  status_text text;
  notification_message text;
  -- الحالات المهمة فقط التي تستحق إشعارات
  allowed_statuses text[] := ARRAY[
    '3','4','14','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44'
  ];
BEGIN
  -- فقط لطلبات الوسيط
  IF lower(coalesce(NEW.delivery_partner, '')) <> 'alwaseet' THEN
    RETURN NEW;
  END IF;

  -- لا ترسل إلا عند تغير حالة التوصيل فعلاً
  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- تطبيع الحالة إلى كود رقمي
  status_code := COALESCE(NULLIF(TRIM(NEW.delivery_status), ''), '');
  IF status_code !~ '^\n?\d+$' THEN
    IF status_code ~* 'فعال|قيد\s*التجهيز' THEN
      status_code := '1';
    END IF;
  END IF;

  -- السماح بإرسال الإشعارات فقط للحالات المهمة المحددة
  IF status_code = '' OR NOT (status_code = ANY(allowed_statuses)) THEN
    RETURN NEW;
  END IF;

  -- رقم التتبع المعروض: أولوية لـ tracking_number ثم order_number ثم id
  msg_number := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

  -- الحصول على النص الحرفي للحالة من تعريفات الوسيط
  status_text := CASE status_code
    WHEN '3'  THEN 'قيد التوصيل الى الزبون (في عهدة المندوب)'
    WHEN '4'  THEN 'تم التسليم للزبون'
    WHEN '14' THEN 'اعادة الارسال الى الزبون'
    WHEN '16' THEN 'قيد الارجاع الى التاجر (في عهدة المندوب)'
    WHEN '17' THEN 'تم الارجاع الى التاجر'
    WHEN '18' THEN 'تغيير سعر'
    WHEN '19' THEN 'ارجاع بعد الاستلام'
    WHEN '20' THEN 'تبديل بعد التوصيل'
    WHEN '21' THEN 'تم التسليم للزبون واستلام منة الاسترجاع'
    WHEN '22' THEN 'ارسال الى الفزر'
    WHEN '23' THEN 'ارسال الى مخزن الارجاعات'
    WHEN '24' THEN 'تم تغيير محافظة الزبون'
    WHEN '25' THEN 'لا يرد'
    WHEN '26' THEN 'لا يرد بعد الاتفاق'
    WHEN '27' THEN 'مغلق'
    WHEN '28' THEN 'مغلق بعد الاتفاق'
    WHEN '29' THEN 'مؤجل'
    WHEN '30' THEN 'مؤجل لحين اعادة الطلب لاحقا'
    WHEN '31' THEN 'الغاء الطلب'
    WHEN '32' THEN 'رفض الطلب'
    WHEN '33' THEN 'مفصول عن الخدمة'
    WHEN '34' THEN 'طلب مكرر'
    WHEN '35' THEN 'مستلم مسبقا'
    WHEN '36' THEN 'الرقم غير معرف'
    WHEN '37' THEN 'الرقم غير داخل في الخدمة'
    WHEN '38' THEN 'العنوان غير دقيق'
    WHEN '39' THEN 'لم يطلب'
    WHEN '40' THEN 'حظر المندوب'
    WHEN '41' THEN 'لا يمكن الاتصال بالرقم'
    WHEN '42' THEN 'تغيير المندوب'
    WHEN '44' THEN 'اخراج من المخزن وارسالة الى الفرز'
    ELSE 'حالة غير معروفة'
  END;

  -- صيغة الرسالة المطلوبة: رقم التتبع + الحالة
  notification_message := msg_number || ' ' || status_text;

  -- منع التكرار المنطقي: نفس الطلب + نفس الحالة + نفس المستلم
  SELECT id INTO existing_notification_id
  FROM public.notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND (data->>'delivery_status') = status_code
    AND COALESCE(user_id::text, 'admin') = COALESCE(NEW.created_by::text, 'admin')
  LIMIT 1;

  IF existing_notification_id IS NULL THEN
    -- إشعار لصاحب الطلب (الموظف)
    INSERT INTO public.notifications (type, title, message, user_id, data, priority)
    VALUES (
      'alwaseet_status_change',
      'تحديث حالة الطلب',
      notification_message,
      NEW.created_by,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone
      ),
      'medium'
    );
  END IF;

  -- إشعار عام للمديرين (user_id null) مع منع التكرار لنفس المجموعة
  SELECT id INTO existing_notification_id
  FROM public.notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND (data->>'delivery_status') = status_code
    AND user_id IS NULL
  LIMIT 1;

  IF existing_notification_id IS NULL THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority)
    VALUES (
      'alwaseet_status_change',
      'تحديث حالة الطلب',
      notification_message,
      NULL,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'employee_id', NEW.created_by
      ),
      'medium'
    );
  END IF;

  RETURN NEW;
END;
$function$;