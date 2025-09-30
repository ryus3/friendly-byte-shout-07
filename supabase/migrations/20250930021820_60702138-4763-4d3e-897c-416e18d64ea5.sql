-- إنشاء دالة لاستخراج سطر العنوان فقط
CREATE OR REPLACE FUNCTION public.extract_address_line_only(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_clean_line text;
BEGIN
  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(input_text, E'\n');
  
  -- البحث عن السطر الذي يحتوي على عنوان (يحتوي على مدينة)
  FOREACH v_line IN ARRAY v_lines
  LOOP
    -- تنظيف السطر من المسافات الزائدة
    v_clean_line := trim(v_line);
    
    -- تجاهل الأسطر الفارغة
    IF length(v_clean_line) < 3 THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تحتوي على أرقام هاتف فقط
    IF v_clean_line ~ '^[0-9\s\-\+]+$' THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تبدأ بأسماء منتجات معروفة
    IF lower(v_clean_line) ~* '^(برشلونة|ريال|ارجنتين|سوت شيك|مانشستر)' THEN
      CONTINUE;
    END IF;
    
    -- التحقق من وجود مدينة في السطر
    IF EXISTS (
      SELECT 1 FROM cities_cache cc 
      WHERE cc.is_active = true 
      AND lower(v_clean_line) LIKE '%' || lower(cc.name) || '%'
    ) THEN
      -- إزالة رقم الهاتف من نهاية السطر إن وجد
      v_clean_line := regexp_replace(v_clean_line, '\s*0[0-9]{10}\s*$', '', 'g');
      
      -- إزالة أسماء المنتجات والألوان والقياسات من نهاية السطر
      v_clean_line := regexp_replace(v_clean_line, '\s+(برشلونة|ريال|ارجنتين|سوت شيك|مانشستر|احمر|ازرق|اخضر|اصفر|ابيض|اسود|xl|l|m|s|xs|xxl|اكس|لارج|ميديم|سمول)\s*.*$', '', 'gi');
      
      -- إزالة الأرقام من نهاية السطر (الكميات)
      v_clean_line := regexp_replace(v_clean_line, '\s+[0-9]+\s*$', '', 'g');
      
      RETURN trim(v_clean_line);
    END IF;
  END LOOP;
  
  -- إذا لم نجد سطر عنوان مناسب، نأخذ السطر الأول ونظفه
  IF array_length(v_lines, 1) > 0 THEN
    v_clean_line := trim(v_lines[1]);
    
    -- إزالة رقم الهاتف
    v_clean_line := regexp_replace(v_clean_line, '\s*0[0-9]{10}\s*', ' ', 'g');
    
    -- إزالة أسماء المنتجات والألوان والقياسات
    v_clean_line := regexp_replace(v_clean_line, '\s+(برشلونة|ريال|ارجنتين|سوت شيك|مانشستر|احمر|ازرق|اخضر|اصفر|ابيض|اسود|xl|l|m|s|xs|xxl|اكس|لارج|ميديم|سمول)\s*.*$', '', 'gi');
    
    -- إزالة الأرقام
    v_clean_line := regexp_replace(v_clean_line, '\s+[0-9]+\s*', ' ', 'g');
    
    -- تنظيف المسافات المتكررة
    v_clean_line := regexp_replace(v_clean_line, '\s+', ' ', 'g');
    
    RETURN trim(v_clean_line);
  END IF;
  
  -- إذا فشل كل شيء، إرجاع النص الأصلي
  RETURN COALESCE(NULLIF(trim(input_text), ''), 'لم يُحدد');
END;
$function$;

-- تحديث دالة process_telegram_order لاستخدام العنوان المنظف
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_items jsonb,
  p_telegram_chat_id bigint DEFAULT NULL,
  p_original_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_clean_address text;
  v_address_words text[];
  v_word text;
  v_city_id integer;
  v_region_id integer;
  v_customer_city text := 'لم يُحدد';
  v_customer_region text := 'لم يُحدد';
  v_landmark text := '';
  v_remaining_words text[] := ARRAY[]::text[];
  v_city_found boolean := false;
  v_region_found boolean := false;
  v_word_index integer := 1;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_final_amount numeric;
  v_item jsonb;
  v_full_address text;
BEGIN
  RAISE NOTICE '🔄 معالجة الطلب باستخدام النسخة العاملة من process_telegram_order...';
  
  -- استخراج سطر العنوان النظيف فقط
  v_clean_address := extract_address_line_only(p_customer_address);
  RAISE NOTICE '🧹 العنوان بعد التنظيف: %', v_clean_address;
  
  -- تقسيم العنوان المنظف إلى كلمات
  v_address_words := string_to_array(lower(trim(v_clean_address)), ' ');
  
  -- المرحلة الأولى: البحث عن المدينة
  FOREACH v_word IN ARRAY v_address_words
  LOOP
    -- تجاهل الكلمات القصيرة جداً
    IF length(v_word) < 2 THEN
      v_word_index := v_word_index + 1;
      CONTINUE;
    END IF;
    
    -- البحث عن المدينة
    IF NOT v_city_found THEN
      SELECT cc.id, cc.name INTO v_city_id, v_customer_city
      FROM cities_cache cc
      WHERE cc.is_active = true
        AND (lower(cc.name) = v_word OR lower(cc.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(cc.name) || '%')
      ORDER BY 
        CASE WHEN lower(cc.name) = v_word THEN 1
             WHEN lower(cc.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_city_id IS NOT NULL THEN
        v_city_found := true;
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_customer_city, v_city_id;
        v_word_index := v_word_index + 1;
        CONTINUE;
      END IF;
    END IF;
    
    -- المرحلة الثانية: البحث عن المنطقة (بعد العثور على المدينة)
    IF v_city_found AND NOT v_region_found THEN
      SELECT rc.id, rc.name INTO v_region_id, v_customer_region
      FROM regions_cache rc
      WHERE rc.is_active = true
        AND rc.city_id = v_city_id
        AND (lower(rc.name) = v_word OR lower(rc.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(rc.name) || '%')
      ORDER BY 
        CASE WHEN lower(rc.name) = v_word THEN 1
             WHEN lower(rc.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_region_id IS NOT NULL THEN
        v_region_found := true;
        RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_customer_region, v_region_id;
        v_word_index := v_word_index + 1;
        CONTINUE;
      END IF;
    END IF;
    
    -- المرحلة الثالثة: جمع الكلمات المتبقية كأقرب نقطة دالة
    IF v_city_found AND v_region_found THEN
      v_remaining_words := array_append(v_remaining_words, v_word);
    END IF;
    
    v_word_index := v_word_index + 1;
  END LOOP;
  
  -- تجميع أقرب نقطة دالة من الكلمات المتبقية
  IF array_length(v_remaining_words, 1) > 0 THEN
    v_landmark := array_to_string(v_remaining_words, ' ');
  ELSE
    v_landmark := 'لم يُحدد';
  END IF;
  
  RAISE NOTICE '🎯 أقرب نقطة دالة: %', v_landmark;
  
  -- حساب المبلغ الإجمالي من العناصر
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;
  
  v_final_amount := v_total_amount + v_delivery_fee;
  
  -- تجميع العنوان الكامل للعرض
  v_full_address := v_customer_city || ' - ' || v_customer_region || 
    CASE WHEN v_landmark != 'لم يُحدد' AND v_landmark != '' THEN ' - ' || v_landmark ELSE '' END;
  
  -- إنشاء الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone, 
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    items,
    total_amount,
    status,
    telegram_chat_id,
    original_text,
    order_data
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    v_full_address,  -- العنوان الكامل المنسق
    v_customer_city,
    v_customer_region,  -- المنطقة في customer_province
    v_city_id,
    v_region_id,
    p_items,
    v_final_amount,
    'pending',
    p_telegram_chat_id,
    p_original_text,
    jsonb_build_object(
      'city_id', v_city_id,
      'region_id', v_region_id,
      'city_name', v_customer_city,
      'region_name', v_customer_region,
      'landmark', v_landmark,
      'clean_address', v_clean_address,
      'delivery_fee', v_delivery_fee,
      'product_total', v_total_amount
    )
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✅ نتيجة معالجة الطلب: %', jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'items', p_items,
    'customer_name', p_customer_name,
    'customer_phone', p_customer_phone,
    'customer_address', v_full_address,
    'customer_city', v_customer_city,
    'customer_region', v_customer_region,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'landmark', v_landmark,
    'product_total', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'total_amount', v_total_amount,
    'final_amount', v_final_amount
  );
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'items', p_items,
    'customer_name', p_customer_name,
    'customer_phone', p_customer_phone,
    'customer_address', v_full_address,
    'customer_city', v_customer_city,
    'customer_region', v_customer_region,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'landmark', v_landmark,
    'product_total', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'total_amount', v_total_amount,
    'final_amount', v_final_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'items', '[]'::jsonb
    );
END;
$function$;