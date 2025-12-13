
-- إرسال إشعارات للطلبات المكتملة
INSERT INTO notifications (
  user_id,
  title,
  message,
  type,
  data,
  is_read,
  created_at
)
SELECT 
  o.created_by,
  'طلب مكتمل ✅',
  'تم اكتمال الطلب رقم ' || COALESCE(o.tracking_number, o.order_number) || ' بقيمة ' || COALESCE(o.final_amount, o.total_amount, 0) || ' د.ع',
  'order_completed',
  jsonb_build_object(
    'order_id', o.id,
    'tracking_number', o.tracking_number,
    'order_number', o.order_number,
    'total_amount', COALESCE(o.final_amount, o.total_amount, 0),
    'completed_at', o.updated_at
  ),
  false,
  NOW()
FROM orders o
WHERE o.status = 'completed'
  AND o.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n 
    WHERE n.type = 'order_completed' 
    AND (n.data->>'order_id')::uuid = o.id
  );

-- تحديث trigger الإشعارات ليستخدم created_by بدلاً من employee_id
CREATE OR REPLACE FUNCTION notify_employee_on_order_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_tracking_number text;
  v_order_total numeric;
BEGIN
  -- فقط عندما يتغير الستاتس إلى completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- جلب معلومات الموظف
    v_employee_id := NEW.created_by;
    v_tracking_number := NEW.tracking_number;
    v_order_total := COALESCE(NEW.final_amount, NEW.total_amount, 0);
    
    IF v_employee_id IS NOT NULL THEN
      -- جلب اسم الموظف
      SELECT full_name INTO v_employee_name
      FROM profiles
      WHERE user_id = v_employee_id;
      
      -- إنشاء إشعار للموظف
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        data,
        is_read,
        created_at
      ) VALUES (
        v_employee_id,
        'طلب مكتمل ✅',
        'تم اكتمال الطلب رقم ' || COALESCE(v_tracking_number, NEW.order_number) || ' بقيمة ' || v_order_total || ' د.ع',
        'order_completed',
        jsonb_build_object(
          'order_id', NEW.id,
          'tracking_number', v_tracking_number,
          'order_number', NEW.order_number,
          'total_amount', v_order_total,
          'completed_at', NOW()
        ),
        false,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
