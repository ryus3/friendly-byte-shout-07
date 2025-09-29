-- تحديث دالة process_telegram_order لاستخراج العنوان الفعلي بعد المدينة والمنطقة
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_ai_order_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_city text;
  v_customer_province text;
  v_customer_address text;
  v_total_amount numeric;
  v_items jsonb;
  v_original_text text;
  v_city_id integer;
  v_region_id integer;
  v_extracted_address text;
BEGIN
  -- البحث عن المستخدم باستخدام employee_code
  SELECT tec.user_id INTO v_user_id
  FROM public.telegram_employee_codes tec
  WHERE tec.employee_code = p_employee_code
    AND tec.telegram_chat_id = p_chat_id
    AND tec.is_active = true;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مربوط'
    );
  END IF;

  -- استخراج البيانات من order_data
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := COALESCE(p_order_data->>'customer_province', v_customer_city);
  v_total_amount := COALESCE((p_order_data->>'final_total')::numeric, (p_order_data->>'total_price')::numeric, 0);
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);
  v_original_text := COALESCE(p_order_data->>'original_text', '');
  v_city_id := COALESCE((p_order_data->>'city_id')::integer, NULL);
  v_region_id := COALESCE((p_order_data->>'region_id')::integer, NULL);

  -- استخراج العنوان الفعلي (أقرب نقطة دالة) من النص الأصلي
  v_extracted_address := extract_actual_address(v_original_text, v_customer_city);
  
  -- استخدام العنوان المستخرج أو العنوان الافتراضي
  v_customer_address := COALESCE(v_extracted_address, p_order_data->>'customer_address', '');

  -- إنشاء AI order مع ربطه بالمستخدم الصحيح
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    city_id,
    region_id,
    total_amount,
    items,
    order_data,
    telegram_chat_id,
    created_by,
    source,
    status,
    original_text
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_province,
    v_customer_address,
    v_city_id,
    v_region_id,
    v_total_amount,
    v_items,
    p_order_data,
    p_chat_id,
    v_user_id,
    'telegram',
    'pending',
    v_original_text
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'user_id', v_user_id,
    'extracted_address', v_extracted_address,
    'message', 'تم حفظ الطلب بنجاح مع استخراج العنوان الفعلي'
  );
END;
$function$;

-- دالة مساعدة لاستخراج العنوان الفعلي من النص الأصلي
CREATE OR REPLACE FUNCTION public.extract_actual_address(p_original_text text, p_city_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_normalized_text text;
  v_words text[];
  v_city_found boolean := false;
  v_region_found boolean := false;
  v_remaining_text text := '';
  v_word text;
  v_found_city text;
  v_found_region text;
  v_address_parts text[] := '{}';
  v_current_index integer := 1;
BEGIN
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(p_original_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المدينة أولاً
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث عن المدينة
    IF NOT v_city_found AND length(v_word) >= 2 THEN
      SELECT cc.name INTO v_found_city
      FROM cities_cache cc 
      WHERE cc.is_active = true 
        AND (lower(cc.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(cc.name) || '%')
      ORDER BY 
        CASE WHEN lower(cc.name) = v_word THEN 1
             WHEN lower(cc.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_found_city IS NOT NULL THEN
        v_city_found := true;
        CONTINUE;
      END IF;
    END IF;
    
    -- البحث عن المنطقة بعد إيجاد المدينة
    IF v_city_found AND NOT v_region_found AND length(v_word) >= 2 THEN
      SELECT rc.name INTO v_found_region
      FROM regions_cache rc 
      WHERE rc.is_active = true 
        AND (lower(rc.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(rc.name) || '%')
      ORDER BY 
        CASE WHEN lower(rc.name) = v_word THEN 1
             WHEN lower(rc.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_found_region IS NOT NULL THEN
        v_region_found := true;
        v_current_index := array_position(v_words, v_word) + 1;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج الجزء المتبقي بعد المدينة والمنطقة
  IF v_city_found AND v_region_found AND v_current_index <= array_length(v_words, 1) THEN
    FOR i IN v_current_index..array_length(v_words, 1)
    LOOP
      -- تجاهل الأرقام القصيرة (أرقام المنتجات أو الكميات)
      IF v_words[i] !~ '^[0-9]{1,3}$' AND length(v_words[i]) >= 2 THEN
        -- تجاهل أسماء المنتجات المعروفة
        IF v_words[i] NOT IN ('تيشرت', 'تشيرت', 'بنطال', 'جينز', 'قميص', 'فستان', 'احمر', 'اخضر', 'ازرق', 'اصفر', 'اسود', 'ابيض', 'كبير', 'صغير', 'وسط', 'ميديم', 'لارج', 'سمول', 'xl', 'xxl', 's', 'm', 'l') THEN
          v_address_parts := array_append(v_address_parts, v_words[i]);
        END IF;
      END IF;
    END LOOP;
    
    -- تجميع أجزاء العنوان
    IF array_length(v_address_parts, 1) > 0 THEN
      v_remaining_text := array_to_string(v_address_parts, ' ');
      -- تنظيف العنوان النهائي
      v_remaining_text := trim(regexp_replace(v_remaining_text, E'\\s+', ' ', 'g'));
    END IF;
  END IF;
  
  -- إرجاع العنوان المستخرج أو NULL إذا لم يوجد
  RETURN CASE 
    WHEN length(trim(v_remaining_text)) > 0 THEN v_remaining_text
    ELSE NULL
  END;
END;
$function$;