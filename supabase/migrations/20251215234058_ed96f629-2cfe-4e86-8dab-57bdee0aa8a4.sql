-- إصلاح وتفعيل trigger إشعار الطلب الجديد للمدير
-- عندما يكتب موظف طلب جديد، يصل إشعار للمدير

-- 1. إعادة كتابة function إشعار الطلب الجديد
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  creator_name TEXT;
  admin_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- جلب اسم الموظف المُنشئ
  SELECT full_name INTO creator_name 
  FROM public.profiles WHERE user_id = NEW.created_by;
  
  -- بناء عنوان الإشعار
  notification_title := 'طلب جديد من ' || COALESCE(creator_name, 'موظف');
  
  -- بناء رسالة الإشعار: المدينة - المنطقة + رقم التتبع
  notification_message := COALESCE(NEW.customer_city, '') || 
                          CASE WHEN NEW.customer_province IS NOT NULL AND NEW.customer_province != '' 
                               THEN ' - ' || NEW.customer_province 
                               ELSE '' 
                          END ||
                          E'\n' || 'رقم التتبع: ' || COALESCE(NEW.tracking_number, 'غير متوفر');
  
  -- إرسال إشعار لجميع المديرين (باستثناء المُنشئ نفسه)
  FOR admin_record IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    JOIN public.profiles p ON ur.user_id = p.user_id
    WHERE r.name IN ('super_admin', 'admin', 'manager', 'deputy_admin')
      AND ur.is_active = true
      AND p.is_active = true
      AND ur.user_id != NEW.created_by
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data, created_at)
    VALUES (
      admin_record.user_id,
      notification_title,
      notification_message,
      'new_order',
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', NEW.tracking_number,
        'customer_city', NEW.customer_city,
        'customer_province', NEW.customer_province,
        'created_by', NEW.created_by,
        'creator_name', creator_name
      ),
      NOW()
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS notify_new_order_trigger ON public.orders;

-- 3. إنشاء وتفعيل الـ trigger الجديد
CREATE TRIGGER notify_new_order_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_order();

-- 4. التأكد من أن الـ trigger مفعل
ALTER TABLE public.orders ENABLE TRIGGER notify_new_order_trigger;