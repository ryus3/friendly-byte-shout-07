-- إصلاح دالة notify_alwaseet_status_change لاستخدام customer_province مباشرة
CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_record RECORD;
  notification_id UUID;
  notification_title TEXT;
  notification_link TEXT;
  managers_count INTEGER := 0;
BEGIN
  -- فقط للطلبات من الوسيط
  IF NEW.delivery_partner IS NULL OR NEW.delivery_partner != 'alwaseet' THEN
    RETURN NEW;
  END IF;

  -- فقط عندما تتغير delivery_status
  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  -- جلب معلومات الطلب
  SELECT * INTO order_record FROM public.orders WHERE id = NEW.id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- ✅ الإصلاح: استخدام customer_province مباشرة بدلاً من استخراجها من customer_address
  notification_title := 
    COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
    COALESCE(NULLIF(TRIM(NEW.customer_province), ''), 'غير محدد');

  notification_link := '/tracking-orders';

  -- إرسال إشعار لكل المدراء
  FOR order_record IN 
    SELECT DISTINCT p.user_id
    FROM public.profiles p
    WHERE p.role = 'admin'
      AND p.user_id IS NOT NULL
      AND p.user_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000')
  LOOP
    managers_count := managers_count + 1;
    
    notification_id := gen_random_uuid();
    
    INSERT INTO public.notifications (
      id,
      user_id,
      title,
      message,
      type,
      link,
      metadata,
      created_at,
      read
    )
    VALUES (
      notification_id,
      order_record.user_id,
      notification_title,
      CASE 
        WHEN NEW.delivery_status = '4' THEN 'تم تسليم طلب من الوسيط'
        WHEN NEW.delivery_status = '17' THEN 'تم إرجاع طلب من الوسيط'
        ELSE 'تحديث حالة طلب من الوسيط'
      END,
      CASE 
        WHEN NEW.delivery_status = '4' THEN 'alwaseet_delivered'
        WHEN NEW.delivery_status = '17' THEN 'alwaseet_returned'
        ELSE 'alwaseet_update'
      END,
      notification_link,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'delivery_status', NEW.delivery_status,
        'customer_city', NEW.customer_city,
        'customer_province', NEW.customer_province
      ),
      NOW(),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;