-- إضافة معالجة حالة "تغيير سعر" (18) في trigger الإشعارات

CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_notification_id uuid;
  msg_number text;
  status_code text;
  status_text text;
  notification_message text;
  notification_title text;
  order_age_days integer;
  is_final_state boolean := false;
  allowed_statuses text[] := ARRAY[
    '3','4','14','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','44'
  ];
  final_statuses text[] := ARRAY['4', '17'];
  old_price numeric;
  new_price numeric;
  price_difference numeric;
BEGIN
  IF lower(coalesce(NEW.delivery_partner, '')) <> 'alwaseet' THEN
    RETURN NEW;
  END IF;

  IF OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  SELECT EXTRACT(days FROM (now() - NEW.created_at))::integer INTO order_age_days;
  
  IF order_age_days > 7 AND NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RAISE NOTICE 'تم تجاهل إشعار للطلب القديم %، العمر: % أيام', COALESCE(NEW.order_number, NEW.id::text), order_age_days;
    RETURN NEW;
  END IF;

  status_code := COALESCE(NULLIF(TRIM(NEW.delivery_status), ''), '');
  IF status_code !~ '^\d+$' THEN
    IF status_code ~* 'فعال|قيد\s*التجهيز' THEN
      status_code := '1';
    END IF;
  END IF;

  -- ✅ معالجة خاصة لحالة "تغيير سعر" (18)
  IF status_code = '18' THEN
    old_price := COALESCE(OLD.final_amount, OLD.total_amount, 0);
    new_price := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    price_difference := old_price - new_price;
    
    IF price_difference != 0 THEN
      -- تحديث السعر في الطلب
      NEW.final_amount := new_price;
      NEW.total_amount := new_price;
      
      -- تسجيل في accounting
      INSERT INTO accounting (
        type, 
        category, 
        amount, 
        description, 
        reference_type, 
        reference_id,
        created_at
      ) VALUES (
        CASE WHEN price_difference > 0 THEN 'expense' ELSE 'revenue' END,
        'تغيير سعر من الوسيط',
        ABS(price_difference),
        CASE 
          WHEN price_difference > 0 THEN 'خصم من السعر: -' || ABS(price_difference) || ' د.ع'
          ELSE 'زيادة في السعر: +' || ABS(price_difference) || ' د.ع'
        END,
        'order',
        NEW.id,
        now()
      );
      
      -- إشعار خاص بتغيير السعر
      notification_message := CASE 
        WHEN price_difference > 0 THEN 'خصم ' || ABS(price_difference) || ' د.ع من السعر'
        ELSE 'زيادة ' || ABS(price_difference) || ' د.ع في السعر'
      END;
      
      notification_title := 'تغيير سعر - ' || COALESCE(NEW.order_number, NEW.id::text);
      
      -- إشعار للموظف
      INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
      VALUES (
        'alwaseet_status_change',
        notification_title,
        notification_message,
        NEW.created_by,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'delivery_status', '18',
          'state_id', '18',
          'old_price', old_price,
          'new_price', new_price,
          'price_difference', price_difference
        ),
        'high',
        false
      );
      
      -- إشعار للمدير
      INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
      VALUES (
        'alwaseet_status_change',
        notification_title,
        notification_message,
        NULL,
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'tracking_number', NEW.tracking_number,
          'delivery_status', '18',
          'state_id', '18',
          'old_price', old_price,
          'new_price', new_price,
          'price_difference', price_difference,
          'employee_id', NEW.created_by
        ),
        'high',
        false
      );
    END IF;
    
    RETURN NEW;
  END IF;

  is_final_state := (status_code = ANY(final_statuses));
  
  IF is_final_state AND OLD.delivery_status = ANY(final_statuses) 
     AND NOT (NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false) THEN
    RAISE NOTICE 'تم تجاهل إشعار للطلب % - حالة نهائية مسبقة: %', COALESCE(NEW.order_number, NEW.id::text), OLD.delivery_status;
    RETURN NEW;
  END IF;

  IF status_code = '' OR NOT (status_code = ANY(allowed_statuses)) THEN
    RETURN NEW;
  END IF;

  msg_number := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

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

  notification_message := status_text || ' ' || msg_number;
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 2)), ''),
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 1)), ''),
      'غير محدد'
    );

  SELECT id INTO existing_notification_id
  FROM public.notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND COALESCE(user_id::text, 'admin') = COALESCE(NEW.created_by::text, 'admin')
    AND created_at >= now() - interval '7 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_notification_id IS NULL THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
    VALUES (
      'alwaseet_status_change',
      notification_title,
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
      'medium',
      false
    );
  ELSE
    UPDATE public.notifications
    SET 
      title = notification_title,
      message = notification_message,
      data = jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'delivery_status', status_code,
        'state_id', status_code,
        'delivery_partner', NEW.delivery_partner,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone
      ),
      priority = 'medium',
      is_read = false,
      updated_at = now()
    WHERE id = existing_notification_id;
  END IF;

  SELECT id INTO existing_notification_id
  FROM public.notifications 
  WHERE type = 'alwaseet_status_change'
    AND (data->>'order_id')::uuid = NEW.id
    AND user_id IS NULL
    AND created_at >= now() - interval '7 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF existing_notification_id IS NULL THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
    VALUES (
      'alwaseet_status_change',
      notification_title,
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
      'medium',
      false
    );
  ELSE
    UPDATE public.notifications
    SET 
      title = notification_title,
      message = notification_message,
      data = jsonb_build_object(
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
      priority = 'medium',
      is_read = false,
      updated_at = now()
    WHERE id = existing_notification_id;
  END IF;

  RETURN NEW;
END;
$function$;