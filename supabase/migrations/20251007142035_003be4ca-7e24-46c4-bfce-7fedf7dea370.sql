-- إصلاح دالة process_telegram_order لاستخدام الجدول والعمود الصحيح
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_customer_name text := 'زبون تليغرام';
  v_customer_phone text;
  v_customer_address text;
  v_product_items jsonb;
  v_order_id uuid;
  v_total_amount numeric := 0;
  v_city_name text;
  v_region_name text;
  v_is_city boolean := false;
  v_is_region boolean := false;
  v_city_id integer;
  v_region_id integer;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام - كود الموظف: %, رسالة: %', p_employee_code, p_message_text;

  -- 1. التحقق من كود الموظف والحصول على user_id
  SELECT user_id INTO v_user_id
  FROM public.employee_telegram_codes WHERE telegram_code = p_employee_code
  AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ كود الموظف غير صحيح أو غير مفعل: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  RAISE NOTICE '✅ تم التحقق من كود الموظف - user_id: %', v_user_id;

  -- 2. استخراج رقم الهاتف من الرسالة
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_customer_phone;

  -- 3. استخراج العنوان الفعلي من الرسالة
  v_customer_address := extract_actual_address(p_message_text);
  RAISE NOTICE '📍 العنوان المستخرج: %', v_customer_address;

  -- 4. استخراج اسم المدينة من الرسالة
  v_city_name := COALESCE(
    (SELECT DISTINCT name 
     FROM public.cities_cache 
     WHERE p_message_text ~* ('(^|\s)' || regexp_replace(name, '\s+', '\\s+', 'g') || '(\s|$)')
     AND is_active = true
     ORDER BY length(name) DESC 
     LIMIT 1),
    (SELECT DISTINCT alias_name
     FROM public.city_aliases
     WHERE p_message_text ~* ('(^|\s)' || regexp_replace(alias_name, '\s+', '\\s+', 'g') || '(\s|$)')
     ORDER BY confidence_score DESC, length(alias_name) DESC
     LIMIT 1)
  );

  IF v_city_name IS NOT NULL THEN
    v_is_city := true;
    SELECT id INTO v_city_id FROM public.cities_cache WHERE name = v_city_name AND is_active = true LIMIT 1;
    RAISE NOTICE '🏙️ تم التعرف على المدينة: % (ID: %)', v_city_name, v_city_id;
  ELSE
    RAISE NOTICE '⚠️ لم يتم التعرف على المدينة';
  END IF;

  -- 5. استخراج اسم المنطقة من الرسالة (إذا لم يتم العثور على مدينة)
  IF NOT v_is_city THEN
    SELECT name, id INTO v_region_name, v_region_id
    FROM public.regions_cache
    WHERE p_message_text ~* ('(^|\s)' || regexp_replace(name, '\s+', '\\s+', 'g') || '(\s|$)')
    AND is_active = true
    ORDER BY length(name) DESC
    LIMIT 1;

    IF v_region_name IS NOT NULL THEN
      v_is_region := true;
      RAISE NOTICE '📍 تم التعرف على المنطقة: % (ID: %)', v_region_name, v_region_id;
    ELSE
      RAISE NOTICE '⚠️ لم يتم التعرف على المنطقة';
    END IF;
  END IF;

  -- 6. استخراج المنتجات من الرسالة
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;

  -- 7. حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0) INTO v_total_amount
  FROM jsonb_array_elements(v_product_items) AS item;
  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;

  -- 8. إدراج الطلب في جدول ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    items,
    telegram_chat_id,
    created_by,
    status,
    source,
    original_text,
    resolved_city_name,
    resolved_region_name,
    city_id,
    region_id
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_city_name,
    v_region_name,
    v_total_amount,
    v_product_items,
    p_telegram_chat_id,
    v_user_id,
    'pending',
    'telegram',
    p_message_text,
    v_city_name,
    v_region_name,
    v_city_id,
    v_region_id
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI - ID: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'city_name', v_city_name,
    'region_name', v_region_name,
    'total_amount', v_total_amount,
    'items', v_product_items
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة طلب تليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;