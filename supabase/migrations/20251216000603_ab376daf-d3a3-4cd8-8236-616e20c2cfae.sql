-- إصلاح صيغة إشعار الطلب الجديد للصيغة الأصلية
-- العنوان: المدينة - المنطقة
-- الرسالة: رقم التتبع + طلب جديد بواسطة + اسم الموظف
-- النوع: order_created

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  employee_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
  order_display TEXT;
BEGIN
  -- جلب اسم الموظف المُنشئ
  SELECT COALESCE(p.full_name, p.username, 'موظف') INTO employee_name
  FROM public.profiles p
  WHERE p.user_id = NEW.created_by;

  -- استخدام tracking_number في الرسالة
  order_display := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

  -- ✅ الصيغة الأصلية:
  -- العنوان: المدينة - المنطقة
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
                        COALESCE(NULLIF(TRIM(NEW.customer_province), ''), 'لم يُحدد');
  
  -- الرسالة: رقم التتبع + طلب جديد بواسطة + اسم الموظف
  notification_message := order_display || ' طلب جديد بواسطة ' || COALESCE(employee_name, 'موظف');

  -- إشعار للمديرين فقط (user_id = null) - لا يصل للموظف المنشئ
  -- لا نرسل إشعار إذا كان المنشئ هو المدير العام
  IF NEW.created_by != '91484496-b887-44f7-9e5d-be9db5567604' THEN
    INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read, created_at)
    VALUES (
      'order_created',
      notification_title,
      notification_message,
      NULL,
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'tracking_number', NEW.tracking_number,
        'employee_id', NEW.created_by,
        'employee_name', employee_name,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'customer_city', NEW.customer_city,
        'customer_province', NEW.customer_province,
        'final_amount', NEW.final_amount
      ),
      'high',
      false,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- التأكد من وجود الـ trigger
DROP TRIGGER IF EXISTS notify_new_order_trigger ON public.orders;
CREATE TRIGGER notify_new_order_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

ALTER TABLE public.orders ENABLE TRIGGER notify_new_order_trigger;