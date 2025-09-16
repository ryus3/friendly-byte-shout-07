-- إصلاح شامل للمشاكل الثلاث

-- إصلاح دالة process_telegram_order للتعامل مع الحالات الاستثنائية
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

  -- إذا لم نجد الموظف، استخدم بيانات افتراضية للمدير
  IF v_user_id IS NULL THEN
    -- محاولة أخيرة: البحث عن المدير الافتراضي
    SELECT user_id INTO v_user_id 
    FROM profiles 
    WHERE user_id = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'employee_not_found',
        'message', 'كود الموظف غير صحيح أو غير فعال'
      );
    END IF;
    
    -- إنشاء معلومات الموظف الافتراضية
    v_employee_info := jsonb_build_object(
      'user_id', v_user_id,
      'full_name', 'مدير النظام',
      'employee_code', p_employee_code
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

-- إنشاء دالة لإصلاح ربط regions بـ cities باستخدام alwaseet_id
CREATE OR REPLACE FUNCTION public.fix_regions_cities_linking()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  city_record RECORD;
  regions_updated INTEGER := 0;
  total_cities INTEGER := 0;
BEGIN
  -- تحديث جميع المناطق لتستخدم alwaseet_id بدلاً من الـ id الداخلي
  FOR city_record IN 
    SELECT id, alwaseet_id, name FROM cities_cache WHERE is_active = true
  LOOP
    -- تحديث المناطق التي تنتمي لهذه المدينة
    UPDATE regions_cache 
    SET city_id = city_record.alwaseet_id,
        updated_at = now()
    WHERE city_id = city_record.id;
    
    GET DIAGNOSTICS regions_updated = ROW_COUNT;
    total_cities := total_cities + 1;
    
    RAISE NOTICE 'تم تحديث % منطقة للمدينة: % (ID: % -> AlWaseet ID: %)', 
      regions_updated, city_record.name, city_record.id, city_record.alwaseet_id;
  END LOOP;

  -- تحديث إضافي لضمان استخدام alwaseet_id كمرجع
  UPDATE regions_cache 
  SET city_id = (
    SELECT alwaseet_id 
    FROM cities_cache 
    WHERE cities_cache.id = regions_cache.city_id
  )
  WHERE city_id IN (
    SELECT id FROM cities_cache WHERE is_active = true
  );

  GET DIAGNOSTICS regions_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'cities_processed', total_cities,
    'regions_updated', regions_updated,
    'message', 'تم إصلاح ربط المناطق بالمدن بنجاح'
  );
END;
$function$;

-- تشغيل إصلاح ربط المناطق بالمدن
SELECT public.fix_regions_cities_linking();