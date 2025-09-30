-- حذف الدالة الحالية بالمعاملات الصحيحة أولاً
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, bigint);

-- حذف الدالة الإضافية غير المطلوبة
DROP FUNCTION IF EXISTS public.extract_address_line_only(text);

-- إنشاء الدالة الجديدة مع المعالجة الذكية للعنوان
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
  
  -- متغيرات معالجة العنوان الذكية
  v_address_lines text[];
  v_address_line text;
  v_city_found_line text;
  v_address_words text[];
  v_word text;
  v_city_id integer;
  v_region_id integer;
  v_found_city text := 'لم يُحدد';
  v_found_region text := 'لم يُحدد';
  v_landmark text := '';
  v_remaining_words text[] := ARRAY[]::text[];
  v_city_found boolean := false;
  v_region_found boolean := false;
  v_final_address text;
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
  v_customer_address := COALESCE(p_order_data->>'customer_address', '');
  v_total_amount := COALESCE((p_order_data->>'final_total')::numeric, (p_order_data->>'total_price')::numeric, 0);
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);

  -- *** المعالجة الذكية للعنوان: تحديد سطر العنوان فقط ***
  -- تقسيم العنوان إلى أسطر
  v_address_lines := string_to_array(trim(v_customer_address), E'\n');
  
  -- البحث عن السطر الذي يحتوي على مدينة معروفة (سطر العنوان)
  FOREACH v_address_line IN ARRAY v_address_lines
  LOOP
    -- تنظيف السطر
    v_address_line := trim(v_address_line);
    
    -- تجاهل الأسطر الفارغة أو القصيرة
    IF length(v_address_line) < 3 THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تحتوي على أرقام هاتف فقط
    IF v_address_line ~ '^[0-9\s\-\+]+$' THEN
      CONTINUE;
    END IF;
    
    -- التحقق من وجود مدينة في هذا السطر باستخدام smart_search_city
    IF EXISTS (
      SELECT 1 FROM smart_search_city(v_address_line) 
      WHERE confidence >= 0.8
      LIMIT 1
    ) THEN
      v_city_found_line := v_address_line;
      RAISE NOTICE '🏠 تم تحديد سطر العنوان: %', v_city_found_line;
      EXIT; -- وجدنا سطر العنوان، توقف عن البحث
    END IF;
  END LOOP;
  
  -- إذا لم نجد سطر عنوان محدد، استخدم السطر الأول
  IF v_city_found_line IS NULL AND array_length(v_address_lines, 1) > 0 THEN
    v_city_found_line := trim(v_address_lines[1]);
  END IF;
  
  -- إذا لم نجد أي شيء، استخدم العنوان الكامل
  IF v_city_found_line IS NULL THEN
    v_city_found_line := v_customer_address;
  END IF;
  
  RAISE NOTICE '🎯 سطر العنوان المحدد: %', v_city_found_line;
  
  -- استخدام الدوال الموجودة للبحث الذكي في سطر العنوان فقط
  -- 1. البحث عن المدينة
  SELECT city_id, city_name INTO v_city_id, v_found_city
  FROM smart_search_city(v_city_found_line)
  WHERE confidence >= 0.8
  ORDER BY confidence DESC
  LIMIT 1;
  
  IF v_city_id IS NOT NULL THEN
    v_city_found := true;
    RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city, v_city_id;
    
    -- 2. البحث عن المنطقة في نفس المدينة
    SELECT region_id, region_name INTO v_region_id, v_found_region
    FROM smart_search_region(v_city_found_line, v_city_id)
    WHERE confidence >= 0.8
    ORDER BY confidence DESC
    LIMIT 1;
    
    IF v_region_id IS NOT NULL THEN
      v_region_found := true;
      RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region, v_region_id;
    END IF;
  END IF;
  
  -- 3. استخراج أقرب نقطة دالة من الكلمات المتبقية في سطر العنوان
  v_address_words := string_to_array(lower(trim(v_city_found_line)), ' ');
  
  FOREACH v_word IN ARRAY v_address_words
  LOOP
    IF length(v_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- تجاهل اسم المدينة والمنطقة المعثور عليهما
    IF v_city_found AND lower(v_word) = lower(v_found_city) THEN
      CONTINUE;
    END IF;
    
    IF v_region_found AND lower(v_word) = lower(v_found_region) THEN
      CONTINUE;
    END IF;
    
    -- تجاهل أسماء المنتجات والألوان والأرقام
    IF v_word ~* '^(برشلونة|ريال|ارجنتين|احمر|ازرق|اخضر|اصفر|xl|l|m|s|[0-9]+)$' THEN
      CONTINUE;
    END IF;
    
    -- إضافة الكلمة المتبقية لأقرب نقطة دالة
    v_remaining_words := array_append(v_remaining_words, v_word);
  END LOOP;
  
  -- تجميع أقرب نقطة دالة
  IF array_length(v_remaining_words, 1) > 0 THEN
    v_landmark := trim(array_to_string(v_remaining_words, ' '));
  END IF;
  
  IF v_landmark = '' OR v_landmark IS NULL THEN
    v_landmark := 'لم يُحدد';
  END IF;
  
  RAISE NOTICE '🎯 النتيجة النهائية - المدينة: %, المنطقة: %, أقرب نقطة دالة: %', v_found_city, v_found_region, v_landmark;
  
  -- تجميع العنوان الكامل للعرض النهائي
  v_final_address := v_found_city || ' - ' || v_found_region || 
    CASE WHEN v_landmark != 'لم يُحدد' AND v_landmark != '' THEN ' - ' || v_landmark ELSE '' END;

  -- إنشاء AI order مع العنوان المعالج بذكاء
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    total_amount,
    items,
    order_data,
    telegram_chat_id,
    created_by,
    source,
    status,
    original_text,
    city_id,
    region_id
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_found_city,
    v_found_region,
    v_final_address, -- العنوان المنسق بدقة: "مدينة - منطقة - أقرب نقطة دالة"
    v_total_amount,
    v_items,
    p_order_data || jsonb_build_object(
      'processed_address', v_final_address,
      'address_line_used', v_city_found_line,
      'landmark_extracted', v_landmark
    ),
    p_chat_id,
    v_user_id,
    'telegram',
    'pending',
    COALESCE(p_order_data->>'original_text', 'طلب من التليغرام'),
    v_city_id,
    v_region_id
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'user_id', v_user_id,
    'customer_address', v_final_address,
    'landmark', v_landmark,
    'message', 'تم حفظ الطلب بنجاح مع معالجة ذكية للعنوان'
  );
END;
$function$;