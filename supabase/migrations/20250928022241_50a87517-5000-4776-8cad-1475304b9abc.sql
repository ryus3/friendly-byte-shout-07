-- المرحلة 1: إصلاح حساب المبلغ الإجمالي وتحسين رسائل الخطأ في process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_message_text text, p_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_order jsonb := '{}';
  v_words text[];
  v_word text;
  v_phone text := NULL;
  v_found_city_id integer := NULL;
  v_found_city_name text := NULL;
  v_found_region_id integer := NULL;
  v_found_region_name text := NULL;
  v_address_parts text[] := '{}';
  v_product_items_result jsonb;
  v_product_items jsonb := '[]';
  v_current_item jsonb;
  v_quantity integer := 1;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000; -- أجور التوصيل الثابتة
  v_customer_name text := NULL;
  v_temp_text text;
  v_temp_id uuid;
  v_final_result jsonb;
  v_normalized_text text;
  v_names_words text[] := '{}';
  v_product_colors text[] := '{}';
  v_product_sizes text[] := '{}';
  -- متغيرات منفصلة لنتائج البحث
  v_city_confidence numeric;
  v_region_confidence numeric;
  v_region_city_id integer;
  v_region_city_name text;
  v_region_match_type text;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء معالجة الرسالة: %', p_message_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(p_message_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن رقم الهاتف
  v_temp_text := regexp_replace(p_message_text, '[^0-9+]', '', 'g');
  IF length(v_temp_text) >= 10 THEN
    v_phone := v_temp_text;
    RAISE NOTICE '📱 تم العثور على رقم الهاتف: %', v_phone;
  END IF;
  
  -- جمع الألوان والأحجام المتوفرة لتجنب اعتبارها أسماء
  SELECT array_agg(DISTINCT lower(c.name)) INTO v_product_colors 
  FROM colors c WHERE c.name IS NOT NULL;
  
  SELECT array_agg(DISTINCT lower(s.name)) INTO v_product_sizes 
  FROM sizes s WHERE s.name IS NOT NULL;
  
  -- البحث عن المدينة والمنطقة
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام
    IF length(v_word) < 3 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المدينة
    IF v_found_city_id IS NULL THEN
      SELECT city_id, city_name, confidence INTO v_found_city_id, v_found_city_name, v_city_confidence
      FROM smart_search_city(v_word) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_city_id IS NOT NULL THEN
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city_name, v_found_city_id;
      END IF;
    END IF;
    
    -- البحث عن المنطقة
    IF v_found_region_id IS NULL THEN
      SELECT region_id, region_name, city_id, city_name, match_type, confidence 
      INTO v_found_region_id, v_found_region_name, v_region_city_id, v_region_city_name, v_region_match_type, v_region_confidence
      FROM smart_search_region(v_word, v_found_city_id) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_region_id IS NOT NULL THEN
        RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region_name, v_found_region_id;
      END IF;
    END IF;
    
    -- جمع الكلمات المحتملة للأسماء (تجنب الألوان والأحجام والمدن)
    IF v_word NOT IN (
      SELECT unnest(v_product_colors) 
      UNION ALL 
      SELECT unnest(v_product_sizes)
      UNION ALL
      SELECT lower(v_found_city_name)
      UNION ALL
      SELECT lower(v_found_region_name)
    ) AND length(v_word) > 2 AND v_word !~ '[0-9]' THEN
      -- تحقق من أن الكلمة ليست منتجاً
      IF NOT EXISTS (SELECT 1 FROM products p WHERE lower(p.name) ILIKE '%' || v_word || '%') THEN
        v_names_words := v_names_words || v_word;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج عناصر المنتجات مع فحص التوفر المحسن
  SELECT extract_product_items_with_availability_check(p_message_text) INTO v_product_items_result;
  
  -- فحص النتيجة - إذا فشل فحص التوفر، ارجع الخطأ مباشرة مع البدائل
  IF (v_product_items_result->>'success')::boolean = false THEN
    -- إرجاع رسالة الخطأ مع البدائل المتوفرة بالصيغة المطلوبة
    RETURN jsonb_build_object(
      'success', false,
      'error', v_product_items_result->>'error',
      'message', v_product_items_result->>'message'
    );
  END IF;
  
  v_product_items := v_product_items_result->'items';
  RAISE NOTICE '🛍️ تم استخراج % عنصر من المنتجات', jsonb_array_length(v_product_items);
  
  -- حساب المبلغ الإجمالي (سعر المنتجات فقط)
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_current_item->>'total_price')::numeric, 0);
  END LOOP;
  
  -- تحديد اسم العميل من الكلمات المحتملة
  IF array_length(v_names_words, 1) > 0 THEN
    v_customer_name := initcap(v_names_words[1]);
  ELSE
    v_customer_name := 'عميل';
  END IF;
  
  -- العثور على المستخدم المسؤول عن هذا الطلب بناءً على chat_id
  SELECT user_id INTO v_temp_id 
  FROM employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id 
    AND is_active = true 
  LIMIT 1;
  
  -- إذا لم يوجد مستخدم مرتبط، استخدم المدير الافتراضي
  IF v_temp_id IS NULL THEN
    v_temp_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  END IF;
  
  -- بناء النتيجة النهائية مع المبلغ الإجمالي (منتجات + توصيل)
  v_final_result := jsonb_build_object(
    'success', true,
    'message', '✅ تم تحليل طلبك بنجاح! يرجى مراجعة التفاصيل والتأكيد.',
    'order_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_phone,
      'customer_city', v_found_city_name,
      'customer_province', v_found_region_name,
      'city_id', v_found_city_id,
      'region_id', v_found_region_id,
      'customer_address', p_message_text,
      'items', v_product_items,
      'total_amount', v_total_amount + v_delivery_fee, -- المبلغ الإجمالي شامل التوصيل
      'products_amount', v_total_amount, -- مبلغ المنتجات منفصل
      'delivery_fee', v_delivery_fee, -- أجور التوصيل منفصلة
      'source', 'telegram',
      'telegram_chat_id', p_chat_id,
      'original_text', p_message_text,
      'created_by', v_temp_id
    )
  );
  
  -- إضافة خيارات إضافية إذا لم يتم العثور على مدينة أو منطقة
  IF v_found_city_id IS NULL THEN
    v_final_result := jsonb_set(v_final_result, '{needs_city_selection}', 'true');
    v_final_result := jsonb_set(v_final_result, '{message}', '"⚠️ لم يتم التعرف على المدينة. يرجى تحديد المدينة:"');
  END IF;
  
  IF v_found_region_id IS NULL AND v_found_city_id IS NOT NULL THEN
    v_final_result := jsonb_set(v_final_result, '{needs_region_selection}', 'true');
    v_final_result := jsonb_set(v_final_result, '{message}', '"⚠️ لم يتم التعرف على المنطقة. يرجى تحديد المنطقة:"');
  END IF;
  
  RAISE NOTICE '✅ انتهاء المعالجة بنجاح: %', v_final_result;
  RETURN v_final_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'details', SQLERRM,
      'message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة أو التواصل مع الدعم.'
    );
END;
$function$;

-- المرحلة 2: تحسين دالة فحص التوفر لإرجاع رسائل خطأ ذكية مع البدائل
CREATE OR REPLACE FUNCTION public.extract_product_items_with_availability_check(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb := '[]';
  v_words text[];
  v_word text;
  v_product record;
  v_color record;
  v_size record;
  v_quantity integer := 1;
  v_current_item jsonb;
  v_found_products jsonb := '[]';
  v_found_colors jsonb := '[]';
  v_found_sizes jsonb := '[]';
  v_variant_id uuid;
  v_variant_price numeric;
  v_variant_qty integer;
  v_price numeric := 0;
  v_normalized_text text;
  v_temp_product jsonb;
  v_temp_color jsonb;
  v_temp_size jsonb;
  v_final_items jsonb := '[]';
  v_size_aliases text[] := ARRAY[
    'small', 'سمول', 'صغير', 's',
    'medium', 'ميديم', 'متوسط', 'm', 'وسط',
    'large', 'لارج', 'كبير', 'l',
    'xl', 'اكس لارج', 'كبير جدا', 'extra large',
    'xxl', 'دبل اكس لارج', 'كبير جداً',
    '2xl', '3xl', '4xl', '5xl'
  ];
  v_size_mapping jsonb := jsonb_build_object(
    'small', 'S', 'سمول', 'S', 'صغير', 'S', 's', 'S',
    'medium', 'M', 'ميديم', 'M', 'متوسط', 'M', 'm', 'M', 'وسط', 'M',
    'large', 'L', 'لارج', 'L', 'كبير', 'L', 'l', 'L',
    'xl', 'XL', 'اكس لارج', 'XL', 'كبير جدا', 'XL', 'extra large', 'XL',
    'xxl', 'XXL', 'دبل اكس لارج', 'XXL', 'كبير جداً', 'XXL',
    '2xl', 'XXL', '3xl', 'XXXL', '4xl', 'XXXXL', '5xl', 'XXXXXL'
  );
  v_target_product_name text;
  v_target_color_name text;
  v_target_size_name text;
  v_available_variants text := '';
  v_available_colors text[] := '{}';
  v_available_sizes text[] := '{}';
  v_error_message text := '';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات مع فحص التوفر من النص: %', input_text;
  
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_normalized_text := lower(trim(v_normalized_text));
  
  -- استخراج الكمية بطريقة محسنة - البحث عن أرقام وكلمات كمية
  SELECT GREATEST(
    -- البحث عن "عدد X" أو "× X" 
    COALESCE((regexp_match(input_text, 'عدد\s*(\d+)', 'i'))[1]::integer, 1),
    -- البحث عن "X قطعة" أو "X حبة"
    COALESCE((regexp_match(input_text, '(\d+)\s*(قطعة|حبة|قطع)', 'i'))[1]::integer, 1),
    -- البحث عن "× X" أو "x X"
    COALESCE((regexp_match(input_text, '[×x]\s*(\d+)', 'i'))[1]::integer, 1),
    -- البحث عن أرقام في نهاية النص
    COALESCE((regexp_match(input_text, '\s(\d+)\s*$', 'i'))[1]::integer, 1),
    -- الكمية الافتراضية
    1
  ) INTO v_quantity;
  
  RAISE NOTICE '📝 النص المطبع: %، الكمية المستخرجة: %', v_normalized_text, v_quantity;
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(v_normalized_text, ' ');
  
  -- البحث عن المنتجات
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- البحث المباشر في أسماء المنتجات
    FOR v_product IN 
      SELECT p.id as product_id, p.name as product_name, p.base_price, p.cost_price 
      FROM products p
      WHERE lower(p.name) ILIKE '%' || v_word || '%' 
      AND p.is_active = true
      ORDER BY 
        CASE 
          WHEN lower(p.name) = v_word THEN 1
          WHEN lower(p.name) ILIKE v_word || '%' THEN 2
          WHEN lower(p.name) ILIKE '%' || v_word || '%' THEN 3
          ELSE 4
        END
      LIMIT 1
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.product_id,
        'name', v_product.product_name,
        'base_price', v_product.base_price,
        'cost_price', v_product.cost_price
      );
      v_found_products := v_found_products || v_temp_product;
      v_target_product_name := v_product.product_name;
      RAISE NOTICE '🎯 تم العثور على المنتج: %', v_product.product_name;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) < 2 THEN
      CONTINUE;
    END IF;
    
    FOR v_color IN 
      SELECT c.id as color_id, c.name as color_name 
      FROM colors c
      WHERE lower(c.name) ILIKE '%' || v_word || '%'
      ORDER BY 
        CASE 
          WHEN lower(c.name) = v_word THEN 1
          WHEN lower(c.name) ILIKE v_word || '%' THEN 2
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_color := jsonb_build_object(
        'id', v_color.color_id,
        'name', v_color.color_name
      );
      v_found_colors := v_found_colors || v_temp_color;
      v_target_color_name := v_color.color_name;
      RAISE NOTICE '🎨 تم العثور على اللون: %', v_color.color_name;
    END LOOP;
  END LOOP;
  
  -- البحث عن الأحجام
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) < 1 THEN
      CONTINUE;
    END IF;
    
    -- محاولة تطبيق mapping للأحجام
    IF v_size_mapping ? v_word THEN
      v_word := v_size_mapping->>v_word;
    END IF;
    
    FOR v_size IN 
      SELECT s.id as size_id, s.name as size_name 
      FROM sizes s
      WHERE lower(s.name) = lower(v_word) 
         OR lower(s.name) ILIKE '%' || v_word || '%'
      ORDER BY 
        CASE 
          WHEN lower(s.name) = lower(v_word) THEN 1
          WHEN lower(s.name) ILIKE lower(v_word) || '%' THEN 2
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_size := jsonb_build_object(
        'id', v_size.size_id,
        'name', v_size.size_name
      );
      v_found_sizes := v_found_sizes || v_temp_size;
      v_target_size_name := v_size.size_name;
      RAISE NOTICE '📏 تم العثور على الحجم: %', v_size.size_name;
    END LOOP;
  END LOOP;
  
  -- تحقق من وجود منتج واحد على الأقل
  IF jsonb_array_length(v_found_products) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_product_found',
      'message', '⚠️ لم يتم العثور على أي منتج. يرجى التأكد من اسم المنتج.'
    );
  END IF;
  
  -- معالجة كل منتج
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_current_item->>'id')::uuid;
      v_product_name text := v_current_item->>'name';
      v_base_price numeric := (v_current_item->>'base_price')::numeric;
      v_color_id uuid := NULL;
      v_color_name text := NULL;
      v_size_id uuid := NULL;
      v_size_name text := NULL;
      v_temp_color_item jsonb;
      v_temp_size_item jsonb;
    BEGIN
      -- تعيين اللون والحجم إذا وجدا
      IF jsonb_array_length(v_found_colors) > 0 THEN
        v_temp_color_item := v_found_colors->0;
        v_color_id := (v_temp_color_item->>'id')::uuid;
        v_color_name := v_temp_color_item->>'name';
      END IF;
      
      IF jsonb_array_length(v_found_sizes) > 0 THEN
        v_temp_size_item := v_found_sizes->0;
        v_size_id := (v_temp_size_item->>'id')::uuid;
        v_size_name := v_temp_size_item->>'name';
      END IF;
      
      -- البحث عن variant مطابق
      SELECT pv.id, pv.price, 
             COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_qty
      INTO v_variant_id, v_variant_price, v_variant_qty
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      LIMIT 1;
      
      -- فحص التوفر وإرجاع رسالة خطأ ذكية إذا لم يكن متوفراً
      IF v_variant_id IS NULL OR COALESCE(v_variant_qty, 0) < v_quantity THEN
        -- بناء رسالة خطأ ذكية
        v_error_message := 'فشل في إنشاء الطلب: المنتج "' || v_product_name || '"';
        
        IF v_color_name IS NOT NULL AND v_size_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر باللون "' || v_color_name || '" والحجم "' || v_size_name || '".';
        ELSIF v_color_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر باللون "' || v_color_name || '".';
        ELSIF v_size_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر بالحجم "' || v_size_name || '".';
        ELSE
          v_error_message := v_error_message || ' غير متوفر حالياً.';
        END IF;
        
        -- جمع البدائل المتوفرة
        SELECT string_agg(DISTINCT 
          COALESCE(c.name, 'افتراضي') || ' - ' || COALESCE(s.name, 'افتراضي') || 
          ' (متوفر: ' || COALESCE(i.quantity - i.reserved_quantity, 0) || ')',
          E'\n'
        ), 
        array_agg(DISTINCT COALESCE(c.name, 'افتراضي')),
        array_agg(DISTINCT COALESCE(s.name, 'افتراضي'))
        INTO v_available_variants, v_available_colors, v_available_sizes
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON i.variant_id = pv.id
        WHERE pv.product_id = v_product_id
          AND COALESCE(i.quantity - i.reserved_quantity, 0) > 0;
        
        -- إضافة البدائل إلى رسالة الخطأ
        IF v_available_variants IS NOT NULL THEN
          v_error_message := v_error_message || E'\n\nالمتوفر من هذا المنتج حالياً:\n' || v_available_variants;
        ELSE
          v_error_message := v_error_message || E'\n\nهذا المنتج غير متوفر حالياً بأي مواصفات.';
        END IF;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'out_of_stock',
          'message', v_error_message,
          'available_variants', v_available_variants,
          'available_colors', v_available_colors,
          'available_sizes', v_available_sizes
        );
      END IF;
      
      -- إضافة العنصر للنتيجة
      v_price := COALESCE(v_variant_price, v_base_price);
      
      v_final_items := v_final_items || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'variant_id', v_variant_id,
        'color', v_color_name,
        'size', v_size_name,
        'quantity', v_quantity,
        'unit_price', v_price,
        'total_price', v_price * v_quantity,
        'available_quantity', v_variant_qty
      );
      
      RAISE NOTICE '✅ تم إضافة المنتج: % - % × %', v_product_name, v_price, v_quantity;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ انتهاء استخراج المنتجات بنجاح: % عنصر', jsonb_array_length(v_final_items);
  
  RETURN jsonb_build_object(
    'success', true,
    'items', v_final_items
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'extraction_error',
      'details', SQLERRM,
      'message', '⚠️ عذراً، حدث خطأ في معالجة المنتجات.'
    );
END;
$function$;