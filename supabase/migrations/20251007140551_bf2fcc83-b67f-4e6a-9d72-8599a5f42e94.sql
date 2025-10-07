-- إصلاح دالة process_telegram_order لإضافة فحص city_aliases
-- نسخة محدثة مع تصحيح اسم الجدول

DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_text text,
  p_phone text,
  p_chat_id bigint,
  p_employee_id uuid,
  p_employee_code text,
  p_employee_username text DEFAULT NULL,
  p_employee_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_lines text[];
  v_first_line text;
  v_customer_name text := 'زبون تليغرام';
  v_is_city boolean := false;
  v_city_name text;
  v_region_name text;
  v_address_line text;
  v_delivery_fee numeric := 5000;
  v_product_items jsonb;
  v_customer_id uuid;
  v_order_id uuid;
  v_final_amount numeric := 0;
  v_result jsonb;
  v_city_id integer;
  v_region_id integer;
  v_alternatives_message text := '';
  v_item jsonb;
  v_any_unavailable boolean := false;
  v_customer_city text;
  v_customer_province text;
BEGIN
  RAISE NOTICE '🔵 بدء معالجة طلب تليغرام - النص: %', p_text;
  RAISE NOTICE '📞 رقم الهاتف: %', p_phone;
  RAISE NOTICE '👤 معرف الموظف: %', p_employee_id;
  RAISE NOTICE '🔑 كود الموظف: %', p_employee_code;

  -- التحقق من صحة معرف الموظف
  IF p_employee_id IS NULL THEN
    RAISE NOTICE '⚠️ معرف الموظف فارغ، محاولة البحث بكود الموظف: %', p_employee_code;
    
    IF p_employee_code IS NOT NULL THEN
      SELECT user_id INTO p_employee_id 
      FROM public.employee_telegram_codes
      WHERE telegram_code = p_employee_code 
        AND is_active = true
      LIMIT 1;
      
      IF p_employee_id IS NULL THEN
        RAISE NOTICE '❌ لم يتم العثور على موظف بالكود: %', p_employee_code;
        RETURN jsonb_build_object(
          'success', false,
          'error', 'invalid_employee_code',
          'message', 'كود الموظف غير صحيح أو غير مفعل'
        );
      ELSE
        RAISE NOTICE '✅ تم العثور على معرف الموظف: %', p_employee_id;
      END IF;
    ELSE
      RAISE NOTICE '❌ لا يوجد كود موظف للبحث';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'missing_employee_info',
        'message', 'معلومات الموظف غير متوفرة'
      );
    END IF;
  END IF;

  v_lines := string_to_array(p_text, E'\n');
  v_first_line := COALESCE(NULLIF(TRIM(v_lines[1]), ''), '');
  
  RAISE NOTICE '📋 السطر الأول: %', v_first_line;

  -- فحص إذا كان السطر الأول يبدأ بمدينة أو مرادف مدينة
  SELECT (
    EXISTS(
      SELECT 1 FROM public.cities_cache
      WHERE LOWER(v_first_line) ILIKE LOWER(name) || '%'
         OR LOWER(v_first_line) ILIKE LOWER(name_ar) || '%'
         OR LOWER(v_first_line) ILIKE LOWER(name_en) || '%'
    ) OR EXISTS(
      SELECT 1 FROM public.city_aliases ca
      JOIN public.cities_cache cc ON cc.id = ca.city_id
      WHERE cc.is_active = true
        AND (LOWER(v_first_line) ILIKE LOWER(ca.alias_name) || '%'
             OR LOWER(v_first_line) ILIKE '%' || LOWER(ca.alias_name) || '%'
             OR LOWER(v_first_line) ILIKE LOWER(ca.normalized_name) || '%'
             OR LOWER(v_first_line) ILIKE '%' || LOWER(ca.normalized_name) || '%')
    )
  ) INTO v_is_city;

  IF v_is_city THEN
    RAISE NOTICE '🏙️ السطر الأول يبدأ بمدينة';
    v_address_line := v_first_line;
    IF array_length(v_lines, 1) > 1 THEN
      v_customer_name := COALESCE(NULLIF(TRIM(v_lines[2]), ''), 'زبون تليغرام');
    END IF;
  ELSE
    RAISE NOTICE '👤 السطر الأول هو اسم الزبون';
    v_customer_name := v_first_line;
    IF array_length(v_lines, 1) > 1 THEN
      v_address_line := COALESCE(NULLIF(TRIM(v_lines[2]), ''), '');
    END IF;
  END IF;

  RAISE NOTICE '📝 اسم الزبون المستخرج: %', v_customer_name;
  RAISE NOTICE '📍 سطر العنوان: %', v_address_line;

  v_product_items := extract_product_items_from_text(p_text);
  RAISE NOTICE '📦 عناصر المنتجات المستخرجة: %', v_product_items;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_final_amount := v_final_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    
    IF (v_item->>'is_available')::boolean = false THEN
      v_any_unavailable := true;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', '');
    END IF;
  END LOOP;

  IF v_any_unavailable THEN
    RAISE NOTICE '⚠️ يوجد منتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_unavailable',
      'message', v_alternatives_message,
      'customer_name', v_customer_name,
      'phone', p_phone,
      'items', v_product_items
    );
  END IF;

  v_final_amount := v_final_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ النهائي (مع التوصيل): %', v_final_amount;

  SELECT 
    COALESCE(cc.name, 'غير محدد'),
    rc.id,
    cc.id
  INTO v_city_name, v_region_id, v_city_id
  FROM public.regions_cache rc
  JOIN public.cities_cache cc ON rc.city_id = cc.id
  WHERE LOWER(v_address_line) ILIKE '%' || LOWER(rc.name) || '%'
     OR LOWER(v_address_line) ILIKE '%' || LOWER(rc.name_ar) || '%'
     OR LOWER(v_address_line) ILIKE '%' || LOWER(rc.name_en) || '%'
  ORDER BY length(rc.name) DESC
  LIMIT 1;

  IF v_city_name IS NULL THEN
    SELECT name, id
    INTO v_city_name, v_city_id
    FROM public.cities_cache
    WHERE LOWER(v_address_line) ILIKE '%' || LOWER(name) || '%'
       OR LOWER(v_address_line) ILIKE '%' || LOWER(name_ar) || '%'
       OR LOWER(v_address_line) ILIKE '%' || LOWER(name_en) || '%'
    ORDER BY length(name) DESC
    LIMIT 1;
  END IF;

  v_customer_city := COALESCE(v_city_name, 'غير محدد');
  v_customer_province := COALESCE(v_city_name, 'غير محدد');

  RAISE NOTICE '🏙️ المدينة المستخرجة: % (ID: %)', v_customer_city, v_city_id;
  RAISE NOTICE '📍 معرف المنطقة: %', v_region_id;

  INSERT INTO public.customers (name, phone, address, city, province, created_by)
  VALUES (v_customer_name, p_phone, v_address_line, v_customer_city, v_customer_province, p_employee_id)
  ON CONFLICT (phone, created_by) 
  DO UPDATE SET 
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    province = EXCLUDED.province,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  RAISE NOTICE '👤 معرف الزبون: %', v_customer_id;

  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    delivery_fee,
    final_amount,
    status,
    source,
    created_by,
    telegram_chat_id,
    city_id,
    region_id
  ) VALUES (
    v_customer_id,
    v_customer_name,
    p_phone,
    v_address_line,
    v_customer_city,
    v_customer_province,
    v_final_amount - v_delivery_fee,
    v_delivery_fee,
    v_final_amount,
    'pending',
    'telegram',
    p_employee_id,
    p_chat_id,
    v_city_id,
    v_region_id
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '📦 معرف الطلب: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'phone', p_phone,
    'address', v_address_line,
    'city', v_customer_city,
    'region_id', v_region_id,
    'items', v_product_items,
    'total_amount', v_final_amount,
    'message', '✅ تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة الطلب',
      'details', SQLERRM
    );
END;
$function$;