-- تعديل دالة process_telegram_order الصحيحة (8 معاملات) لاستخراج الكلمة الأولى فقط
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_total_amount numeric,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_employee_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_order_id uuid;
  v_city_id integer;
  v_city_name text;
  v_region_name text;
  v_full_address text;
  v_confidence numeric := 0;
  v_suggestions jsonb := '[]'::jsonb;
  v_first_line text;
  v_first_word text;
  v_found_city record;
  v_found_alias record;
BEGIN
  -- البحث عن الموظف باستخدام employee_code
  SELECT id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE telegram_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- استخراج السطر الأول من اسم العميل
  v_first_line := TRIM(SPLIT_PART(p_customer_name, E'\n', 1));
  
  -- استخراج الكلمة الأولى فقط
  v_first_word := TRIM(SPLIT_PART(v_first_line, ' ', 1));
  
  RAISE NOTICE 'السطر الأول: %, الكلمة الأولى: %', v_first_line, v_first_word;

  -- البحث في cities_cache أولاً باستخدام الكلمة الأولى فقط
  SELECT id, name INTO v_found_city
  FROM public.cities_cache
  WHERE is_active = true
    AND (
      LOWER(name) = LOWER(v_first_word)
      OR LOWER(name_ar) = LOWER(v_first_word)
      OR LOWER(name_en) = LOWER(v_first_word)
    )
  LIMIT 1;

  IF v_found_city.id IS NOT NULL THEN
    v_city_id := v_found_city.id;
    v_city_name := v_found_city.name;
    v_confidence := 1.0;
    RAISE NOTICE 'تم العثور على المدينة مباشرة: % (ID: %)', v_city_name, v_city_id;
  ELSE
    -- البحث في city_aliases باستخدام الكلمة الأولى فقط
    SELECT ca.city_id, c.name, ca.confidence_score 
    INTO v_found_alias
    FROM public.city_aliases ca
    JOIN public.cities_cache c ON ca.city_id = c.id
    WHERE c.is_active = true
      AND LOWER(ca.alias_name) = LOWER(v_first_word)
    ORDER BY ca.confidence_score DESC
    LIMIT 1;

    IF v_found_alias.city_id IS NOT NULL THEN
      v_city_id := v_found_alias.city_id;
      v_city_name := v_found_alias.name;
      v_confidence := v_found_alias.confidence_score;
      RAISE NOTICE 'تم العثور على المدينة عبر alias: % (ID: %, الثقة: %)', v_city_name, v_city_id, v_confidence;
    ELSE
      RAISE NOTICE 'لم يتم العثور على المدينة للكلمة: %', v_first_word;
    END IF;
  END IF;

  -- استخراج المنطقة من العنوان
  v_region_name := TRIM(SPLIT_PART(p_customer_address, ',', 1));
  IF v_region_name = '' THEN
    v_region_name := 'غير محدد';
  END IF;

  -- بناء العنوان الكامل
  v_full_address := p_customer_address;

  -- إنشاء الطلب
  INSERT INTO public.orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    total_amount,
    final_amount,
    status,
    created_by,
    source,
    telegram_chat_id,
    city_id,
    location_confidence
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    v_full_address,
    COALESCE(v_city_name, 'غير محدد'),
    p_total_amount,
    p_total_amount,
    'pending',
    v_employee_id,
    'telegram',
    p_telegram_chat_id,
    v_city_id,
    v_confidence
  )
  RETURNING id INTO v_order_id;

  -- إضافة عناصر الطلب
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.order_items (
      order_id,
      product_name,
      quantity,
      price,
      total_price
    )
    SELECT
      v_order_id,
      item->>'product_name',
      (item->>'quantity')::integer,
      (item->>'price')::numeric,
      (item->>'total_price')::numeric
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'city_name', COALESCE(v_city_name, 'غير محدد'),
    'city_id', v_city_id,
    'region_name', v_region_name,
    'confidence', v_confidence,
    'suggestions', v_suggestions
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;