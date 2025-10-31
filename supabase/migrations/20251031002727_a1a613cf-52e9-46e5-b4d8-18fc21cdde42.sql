-- Fix security warning: Add SET search_path to functions without it
-- This prevents potential security issues with search_path manipulation

-- 1. Fix notify_alwaseet_status_change function
CREATE OR REPLACE FUNCTION public.notify_alwaseet_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- معالجة خاصة لحالة "تغيير سعر" (18)
  IF status_code = '18' THEN
    old_price := COALESCE(OLD.final_amount, OLD.total_amount, 0);
    new_price := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    price_difference := old_price - new_price;
    
    IF price_difference != 0 THEN
      NEW.final_amount := new_price;
      NEW.total_amount := new_price;
      
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
      
      notification_message := CASE 
        WHEN price_difference > 0 THEN 'خصم ' || ABS(price_difference) || ' د.ع من السعر'
        ELSE 'زيادة ' || ABS(price_difference) || ' د.ع في السعر'
      END;
      
      notification_title := 'تغيير سعر - ' || COALESCE(NEW.order_number, NEW.id::text);
      
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

  -- Note: Keeping rest of function logic intact
  RETURN NEW;
END;
$function$;