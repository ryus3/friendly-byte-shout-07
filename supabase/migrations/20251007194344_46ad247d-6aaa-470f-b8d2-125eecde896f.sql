-- إضافة عمود notes إلى جدول ai_orders
ALTER TABLE public.ai_orders ADD COLUMN IF NOT EXISTS notes TEXT;

-- تعديل دالة process_telegram_order لاستخراج الملاحظات
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id bigint,
  p_message_text text,
  p_sender_name text DEFAULT 'زبون تليغرام'::text,
  p_created_by text DEFAULT NULL::text,
  p_city_id integer DEFAULT NULL::integer,
  p_region_id integer DEFAULT NULL::integer,
  p_source text DEFAULT 'telegram'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_first_line text;
  v_second_line text;
  v_third_line text;
  v_remaining_text text;
  v_customer_name text := 'زبون تليغرام';
  v_customer_phone text := 'غير محدد';
  v_customer_address text := 'لم يُحدد';
  v_customer_city text;
  v_customer_province text;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_product_items jsonb;
  v_order_id uuid;
  v_resolved_city_name text;
  v_resolved_region_name text;
  v_is_city boolean := FALSE;
  v_first_word text;
  v_notes text := NULL;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام من المحادثة: %', p_chat_id;
  
  v_lines := string_to_array(p_message_text, E'\n');
  v_first_line := COALESCE(NULLIF(TRIM(v_lines[1]), ''), 'غير محدد');
  v_second_line := COALESCE(NULLIF(TRIM(v_lines[2]), ''), '');
  v_third_line := COALESCE(NULLIF(TRIM(v_lines[3]), ''), '');
  
  -- استخراج أول كلمة من السطر الأول
  v_first_word := SPLIT_PART(v_first_line, ' ', 1);
  
  -- ✅ المرحلة 1: التحقق من المدينة في cities_cache أولاً
  SELECT 
    name,
    TRUE
  INTO 
    v_customer_city,
    v_is_city
  FROM public.cities_cache
  WHERE LOWER(name) = LOWER(v_first_word)
     OR LOWER(name_ar) = LOWER(v_first_word)
     OR LOWER(name_en) = LOWER(v_first_word)
  LIMIT 1;

  -- ✅ المرحلة 2: إذا لم نجد، نبحث في city_aliases
  IF NOT v_is_city THEN
    SELECT 
      c.name,
      TRUE
    INTO 
      v_customer_city,
      v_is_city
    FROM public.city_aliases ca
    JOIN public.cities_cache c ON ca.city_id = c.id
    WHERE LOWER(ca.alias_name) = LOWER(v_first_word)
       OR LOWER(ca.normalized_name) = LOWER(v_first_word)
    ORDER BY ca.confidence_score DESC
    LIMIT 1;
  END IF;

  IF v_is_city THEN
    v_customer_address := v_first_line;
    v_customer_phone := extractphonefromtext(v_second_line);
    v_remaining_text := array_to_string(v_lines[3:array_length(v_lines, 1)], E'\n');
    RAISE NOTICE '✅ تم التعرف على المدينة: %', v_customer_city;
  ELSE
    v_customer_name := v_first_line;
    v_customer_phone := extractphonefromtext(v_second_line);
    v_customer_address := extract_actual_address(v_third_line);
    v_customer_city := COALESCE(
      (SELECT name FROM public.cities_cache WHERE LOWER(name) = LOWER(SPLIT_PART(v_third_line, ' ', 1)) LIMIT 1),
      SPLIT_PART(v_third_line, ' ', 1)
    );
    v_remaining_text := array_to_string(v_lines[4:array_length(v_lines, 1)], E'\n');
    RAISE NOTICE '📝 اسم الزبون: %', v_customer_name;
  END IF;

  -- استخراج الملاحظات من أي سطر يحتوي على "ملاحظة" أو "ملاحظه"
  DECLARE
    v_line text;
  BEGIN
    FOREACH v_line IN ARRAY v_lines
    LOOP
      IF v_line ~* 'ملاحظ[ةه]' THEN
        v_notes := TRIM(v_line);
        EXIT;
      END IF;
    END LOOP;
  END;

  v_product_items := extract_product_items_from_text(v_remaining_text);

  SELECT SUM((item->>'total_price')::numeric)
  INTO v_total_amount
  FROM jsonb_array_elements(v_product_items) AS item;

  v_total_amount := COALESCE(v_total_amount, 0);

  v_resolved_city_name := COALESCE(v_customer_city, 'غير محدد');
  v_resolved_region_name := COALESCE(v_customer_province, 'غير محدد');

  INSERT INTO public.ai_orders (
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    resolved_city_name,
    resolved_region_name,
    total_amount,
    delivery_fee,
    items,
    original_text,
    status,
    source,
    created_by,
    city_id,
    region_id,
    notes
  ) VALUES (
    p_chat_id,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_resolved_city_name,
    v_resolved_region_name,
    v_total_amount,
    v_delivery_fee,
    v_product_items,
    p_message_text,
    'pending',
    p_source,
    p_created_by,
    p_city_id,
    p_region_id,
    v_notes
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب ذكي: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'customer_city', v_customer_city,
    'total_amount', v_total_amount,
    'items', v_product_items,
    'notes', v_notes
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;