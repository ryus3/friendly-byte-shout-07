-- إصلاح دالة process_telegram_order لتستخدم user_id بدلاً من employee_code في created_by
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_chat_id bigint DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ai_order_id uuid;
  v_employee_info jsonb;
  v_user_id uuid;
BEGIN
  -- البحث عن معلومات الموظف باستخدام employee_code
  SELECT 
    p.user_id,
    jsonb_build_object(
      'user_id', p.user_id,
      'full_name', p.full_name,
      'employee_code', tec.employee_code
    ) INTO v_user_id, v_employee_info
  FROM public.telegram_employee_codes tec
  JOIN public.profiles p ON tec.user_id = p.user_id
  WHERE tec.employee_code = p_employee_code
    AND tec.is_active = true;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'كود الموظف غير صحيح أو غير فعال'
    );
  END IF;

  -- إنشاء الطلب الذكي مع استخدام user_id
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    order_data,
    items,
    total_amount,
    telegram_chat_id,
    source,
    created_by,
    original_text,
    city_id,
    region_id
  ) VALUES (
    p_order_data->>'customer_name',
    p_order_data->>'customer_phone',
    p_order_data->>'customer_address',
    p_order_data->>'customer_city',
    p_order_data->>'customer_province',
    p_order_data,
    COALESCE(p_order_data->'items', '[]'::jsonb),
    COALESCE((p_order_data->>'total_amount')::numeric, 0),
    p_chat_id,
    'telegram',
    v_user_id, -- استخدام user_id بدلاً من employee_code
    p_order_data->>'original_text',
    COALESCE((p_order_data->>'city_id')::integer, NULL),
    COALESCE((p_order_data->>'region_id')::integer, NULL)
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee', v_employee_info,
    'message', 'تم إنشاء الطلب الذكي بنجاح'
  );
END;
$function$;

-- إصلاح دالة notify_new_order لتتجاهل ai_orders لأنها لها إشعار منفصل
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
  order_display text;
BEGIN
  -- الحصول على اسم الموظف
  SELECT COALESCE(p.full_name, p.username, 'موظف غير معروف') INTO employee_name
  FROM profiles p
  WHERE p.user_id = NEW.created_by;

  -- استخدام tracking_number في الرسالة كما طلب المستخدم
  order_display := COALESCE(NULLIF(NEW.tracking_number, ''), NULLIF(NEW.order_number, ''), NEW.id::text);

  -- صيغة الرسالة المحسنة مع tracking_number
  notification_message := order_display || ' طلب جديد بواسطة ' || employee_name;
  notification_title := COALESCE(NULLIF(TRIM(NEW.customer_city), ''), 'غير محدد') || ' - ' || 
    COALESCE(
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 2)), ''),
      NULLIF(TRIM(SPLIT_PART(NEW.customer_address, ',', 1)), ''),
      'غير محدد'
    );

  -- إشعار للمديرين فقط (user_id = null) - لا يصل للموظف المنشئ
  -- إلا إذا كان المنشئ هو المدير نفسه
  IF NEW.created_by != '91484496-b887-44f7-9e5d-be9db5567604' THEN
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
  END IF;

  RETURN NEW;
END;
$function$;

-- إصلاح ربط المناطق بالمدن في regions_cache
-- تصحيح city_id في regions_cache ليشير إلى cities_cache.alwaseet_id
UPDATE public.regions_cache 
SET city_id = (
  SELECT alwaseet_id 
  FROM cities_cache 
  WHERE id = 1 -- بغداد
)
WHERE city_id = 1;

-- فحص وإصلاح باقي المناطق إذا كانت مرتبطة بمدن أخرى
DO $$
DECLARE
  city_record RECORD;
  region_record RECORD;
BEGIN
  -- تحديث جميع المناطق لتستخدم alwaseet_id بدلاً من الـ id الداخلي
  FOR city_record IN 
    SELECT id, alwaseet_id, name FROM cities_cache WHERE is_active = true
  LOOP
    -- تحديث المناطق التي تنتمي لهذه المدينة
    UPDATE regions_cache 
    SET city_id = city_record.alwaseet_id
    WHERE city_id = city_record.id;
    
    RAISE NOTICE 'تم تحديث المناطق للمدينة: % (ID: % -> AlWaseet ID: %)', 
      city_record.name, city_record.id, city_record.alwaseet_id;
  END LOOP;
END $$;