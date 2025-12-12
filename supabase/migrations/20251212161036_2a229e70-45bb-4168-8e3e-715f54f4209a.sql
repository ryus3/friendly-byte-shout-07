-- إصلاح دالة notify_new_order لاستخدام customer_province بدلاً من customer_address
CREATE OR REPLACE FUNCTION notify_new_order()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  employee_record RECORD;
BEGIN
  -- بناء عنوان الإشعار: المدينة - المنطقة (customer_province)
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
                        COALESCE(NULLIF(TRIM(NEW.customer_province), ''), 'غير محدد');
  
  notification_body := 'طلب جديد من ' || COALESCE(NEW.customer_name, 'عميل') || 
                       ' - المبلغ: ' || COALESCE(NEW.final_amount, NEW.total_amount, 0)::TEXT || ' د.ع';

  -- إرسال إشعار لجميع المدراء والموظفين النشطين
  FOR employee_record IN 
    SELECT user_id FROM profiles WHERE role IN ('manager', 'admin') AND is_active = true
  LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      is_read
    ) VALUES (
      employee_record.user_id,
      'new_order',
      notification_title,
      notification_body,
      jsonb_build_object(
        'order_id', NEW.id,
        'tracking_number', NEW.tracking_number,
        'customer_name', NEW.customer_name,
        'customer_city', NEW.customer_city,
        'customer_province', NEW.customer_province,
        'total_amount', COALESCE(NEW.final_amount, NEW.total_amount, 0)
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;