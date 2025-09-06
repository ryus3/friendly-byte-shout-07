-- إصلاح دالة إشعارات الطلبات الجديدة لإرسال للمديرين فقط
CREATE OR REPLACE FUNCTION public.notify_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  employee_name text;
  notification_title text;
  notification_message text;
  tracking_display text;
BEGIN
  -- الحصول على اسم الموظف
  SELECT COALESCE(p.full_name, p.username, 'موظف غير معروف') INTO employee_name
  FROM profiles p
  WHERE p.user_id = NEW.created_by;

  -- استخدام tracking_number بدلاً من order_number
  tracking_display := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

  -- صيغة الرسالة المحسنة
  notification_message := 'طلب جديد برقم تتبع ' || tracking_display || ' بواسطة ' || employee_name;
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 2)), ''),
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 1)), ''),
      'غير محدد'
    );

  -- إشعار للمديرين فقط (user_id = null) - لا يصل للموظف المنشئ
  INSERT INTO public.notifications (type, title, message, user_id, data, priority, is_read)
  VALUES (
    'order_created',
    notification_title,
    notification_message,
    NULL, -- للمديرين فقط
    jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'tracking_number', NEW.tracking_number,
      'employee_id', NEW.created_by,
      'employee_name', employee_name,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'final_amount', NEW.final_amount
    ),
    'high',
    false
  );

  RETURN NEW;
END;
$function$;

-- إنشاء جدول لسجل المزامنة التلقائية
CREATE TABLE IF NOT EXISTS public.auto_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type text NOT NULL DEFAULT 'scheduled',
  triggered_by text DEFAULT NULL,
  employees_processed integer DEFAULT 0,
  invoices_synced integer DEFAULT 0,
  orders_updated integer DEFAULT 0,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone DEFAULT NULL,
  success boolean DEFAULT false,
  error_message text DEFAULT NULL,
  results jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- تفعيل RLS على جدول سجل المزامنة
ALTER TABLE public.auto_sync_log ENABLE ROW LEVEL SECURITY;

-- سياسة للمديرين فقط
CREATE POLICY "المديرون فقط يديرون سجل المزامنة التلقائية" 
ON public.auto_sync_log 
FOR ALL 
USING (is_admin_or_deputy())
WITH CHECK (is_admin_or_deputy());

-- تحديث إعدادات المزامنة لتشمل مرتين يومياً
ALTER TABLE public.invoice_sync_settings 
ADD COLUMN IF NOT EXISTS sync_frequency text DEFAULT 'once_daily',
ADD COLUMN IF NOT EXISTS morning_sync_time time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS evening_sync_time time DEFAULT '21:00:00';