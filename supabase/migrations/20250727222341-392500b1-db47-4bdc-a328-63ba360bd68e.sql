-- إضافة دالة لإرسال الإشعارات عند إنشاء الطلبات وتغيير الحالات
CREATE OR REPLACE FUNCTION public.send_order_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  employee_name TEXT;
  order_creator_name TEXT;
  status_names JSONB := '{
    "pending": "قيد التجهيز",
    "shipped": "تم الشحن", 
    "delivery": "قيد التوصيل",
    "delivered": "تم التسليم",
    "completed": "مكتمل",
    "returned": "راجعة",
    "returned_in_stock": "راجع للمخزن",
    "cancelled": "ملغي"
  }'::jsonb;
BEGIN
  -- عند إنشاء طلب جديد
  IF TG_OP = 'INSERT' THEN
    -- الحصول على اسم منشئ الطلب
    SELECT full_name INTO order_creator_name 
    FROM public.profiles 
    WHERE user_id = NEW.created_by;
    
    -- إشعار للمديرين عند إنشاء طلب من موظف
    IF NEW.created_by != '91484496-b887-44f7-9e5d-be9db5567604' THEN
      INSERT INTO public.notifications (
        title,
        message,
        type,
        priority,
        data,
        user_id
      ) VALUES (
        'طلب جديد من الموظف',
        'تم إنشاء طلب جديد رقم ' || NEW.order_number || ' بواسطة ' || COALESCE(order_creator_name, 'موظف'),
        'new_order_employee',
        'high',
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'employee_name', order_creator_name,
          'total_amount', NEW.total_amount
        ),
        '91484496-b887-44f7-9e5d-be9db5567604'
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- عند تحديث حالة الطلب
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- الحصول على اسم منشئ الطلب
    SELECT full_name INTO order_creator_name 
    FROM public.profiles 
    WHERE user_id = NEW.created_by;
    
    -- إشعار للمدير عند تغيير الحالة
    INSERT INTO public.notifications (
      title,
      message,
      type,
      priority,
      data,
      user_id
    ) VALUES (
      'تحديث حالة الطلب',
      'تم تغيير حالة الطلب رقم ' || NEW.order_number || ' من "' || 
      COALESCE(status_names->>OLD.status, OLD.status) || '" إلى "' || 
      COALESCE(status_names->>NEW.status, NEW.status) || '"',
      'order_status_update',
      'medium',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'employee_name', order_creator_name
      ),
      '91484496-b887-44f7-9e5d-be9db5567604'
    );
    
    -- إشعار للموظف منشئ الطلب (إذا لم يكن هو المدير)
    IF NEW.created_by != '91484496-b887-44f7-9e5d-be9db5567604' THEN
      INSERT INTO public.notifications (
        title,
        message,
        type,
        priority,
        data,
        user_id
      ) VALUES (
        'تحديث طلبك',
        'تم تحديث حالة طلبك رقم ' || NEW.order_number || ' إلى "' || 
        COALESCE(status_names->>NEW.status, NEW.status) || '"',
        'my_order_status_update',
        'medium',
        jsonb_build_object(
          'order_id', NEW.id,
          'order_number', NEW.order_number,
          'new_status', NEW.status
        ),
        NEW.created_by
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- إضافة triggers للطلبات
DROP TRIGGER IF EXISTS order_notifications_trigger ON public.orders;
CREATE TRIGGER order_notifications_trigger
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION send_order_notifications();