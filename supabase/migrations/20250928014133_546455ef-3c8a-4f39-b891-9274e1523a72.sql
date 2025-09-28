-- Fix the process_telegram_order function to improve customer name extraction
-- and ensure better availability checking

CREATE OR REPLACE FUNCTION public.process_telegram_order(p_message_text text, p_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
  
  -- فحص النتيجة - إذا فشل فحص التوفر، ارجع الخطأ مباشرة
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
  
  -- حساب المبلغ الإجمالي
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
  
  -- بناء النتيجة النهائية
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
      'total_amount', v_total_amount,
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

-- Enhanced extract_product_items function with strict availability checking
CREATE OR REPLACE FUNCTION public.extract_product_items_with_availability_check(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
  v_delivery_fee numeric := 5000;
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
  v_available_variants text := '';
  v_target_product_name text;
  v_error_message text := '';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات مع فحص التوفر الصارم من النص: %', input_text;
  
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_normalized_text := lower(trim(v_normalized_text));
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(v_normalized_text, ' ');
  
  RAISE NOTICE '📝 النص المطبع: %', v_normalized_text;
  
  -- البحث عن المنتجات
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- البحث المباشر في أسماء المنتجات
    FOR v_product IN 
      SELECT id, name, base_price, cost_price 
      FROM products 
      WHERE lower(name) ILIKE '%' || v_word || '%' 
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN lower(name) = v_word THEN 1
          WHEN lower(name) ILIKE v_word || '%' THEN 2
          WHEN lower(name) ILIKE '%' || v_word || '%' THEN 3
          ELSE 4
        END
      LIMIT 1
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'base_price', COALESCE(v_product.base_price, 0),
        'cost_price', COALESCE(v_product.cost_price, 0)
      );
      
      IF NOT (v_temp_product = ANY(SELECT jsonb_array_elements(v_found_products))) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
        v_target_product_name := v_product.name;
        RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان
  FOREACH v_word IN ARRAY v_words
  LOOP
    FOR v_color IN 
      SELECT id, name 
      FROM colors 
      WHERE lower(name) = v_word
      ORDER BY length(name) DESC
      LIMIT 1
    LOOP
      v_temp_color := jsonb_build_object('id', v_color.id, 'name', v_color.name);
      IF NOT (v_temp_color = ANY(SELECT jsonb_array_elements(v_found_colors))) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
        RAISE NOTICE '🎨 تم العثور على اللون: % (ID: %)', v_color.name, v_color.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الأحجام مع المرادفات
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word = ANY(v_size_aliases) THEN
      DECLARE
        v_mapped_size text := v_size_mapping->>v_word;
      BEGIN
        FOR v_size IN 
          SELECT id, name 
          FROM sizes 
          WHERE lower(name) = lower(v_mapped_size) OR lower(name) = v_word
          LIMIT 1
        LOOP
          v_temp_size := jsonb_build_object('id', v_size.id, 'name', v_size.name);
          IF NOT (v_temp_size = ANY(SELECT jsonb_array_elements(v_found_sizes))) THEN
            v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
            RAISE NOTICE '📏 تم العثور على الحجم: % (ID: %)', v_size.name, v_size.id;
          END IF;
        END LOOP;
      END;
    END IF;
  END LOOP;
  
  -- فحص التوفر الصارم والبناء النهائي للعناصر
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_current_item->>'id')::uuid;
      v_product_name text := v_current_item->>'name';
      v_color_id uuid := NULL;
      v_color_name text := NULL;
      v_size_id uuid := NULL;
      v_size_name text := NULL;
      v_variant_found boolean := false;
      v_unit_price numeric := 0;
      v_total_price numeric := 0;
      v_available_qty integer := 0;
      v_requested_color text := NULL;
      v_requested_size text := NULL;
    BEGIN
      -- استخراج اللون والحجم المطلوبين
      IF jsonb_array_length(v_found_colors) > 0 THEN
        v_color_id := (v_found_colors->0->>'id')::uuid;
        v_color_name := v_found_colors->0->>'name';
        v_requested_color := v_color_name;
      END IF;
      
      IF jsonb_array_length(v_found_sizes) > 0 THEN
        v_size_id := (v_found_sizes->0->>'id')::uuid;
        v_size_name := v_found_sizes->0->>'name';
        v_requested_size := v_size_name;
      END IF;
      
      -- البحث عن المتغير المحدد والتحقق من توفره
      SELECT pv.id, 
             COALESCE(pv.price, p.base_price, 0),
             COALESCE(i.quantity, 0)
      INTO v_variant_id, v_unit_price, v_available_qty
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
        AND pv.is_active = true
      LIMIT 1;
      
      -- فحص صارم للتوفر
      IF v_variant_id IS NULL OR v_available_qty <= 0 THEN
        -- بناء رسالة خطأ واضحة مع البدائل
        v_error_message := '❌ فشل في إنشاء الطلب: المنتج "' || v_product_name || '"';
        
        IF v_requested_color IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر باللون "' || v_requested_color || '"';
        END IF;
        
        IF v_requested_size IS NOT NULL THEN
          v_error_message := v_error_message || ' والحجم "' || v_requested_size || '"';
        END IF;
        
        v_error_message := v_error_message || '.';
        
        -- جمع البدائل المتوفرة
        SELECT string_agg(
          DISTINCT COALESCE(c.name, 'افتراضي') || ' (' || 
          string_agg(DISTINCT s.name, '، ' ORDER BY s.name) || ')',
          '، ' ORDER BY COALESCE(c.name, 'افتراضي')
        ) INTO v_available_variants
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product_id
          AND pv.is_active = true
          AND COALESCE(i.quantity, 0) > 0
        GROUP BY c.id, c.name;
        
        IF v_available_variants IS NOT NULL AND v_available_variants != '' THEN
          v_error_message := v_error_message || E'\n\nالمتوفر فعلياً: ' || v_available_variants;
        ELSE
          v_error_message := v_error_message || E'\n\nعذراً، هذا المنتج غير متوفر حالياً.';
        END IF;
        
        -- إرجاع خطأ مع منع إنشاء الطلب
        RETURN jsonb_build_object(
          'success', false,
          'error', 'product_not_available',
          'message', v_error_message
        );
      END IF;
      
      -- إنشاء عنصر الطلب المؤكد
      v_total_price := v_unit_price + v_delivery_fee;
      
      v_final_items := v_final_items || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_product_name,
          'variant_id', v_variant_id,
          'color_id', v_color_id,
          'color', v_color_name,
          'size_id', v_size_id,
          'size', v_size_name,
          'quantity', v_quantity,
          'unit_price', v_unit_price,
          'delivery_fee', v_delivery_fee,
          'total_price', v_total_price,
          'available_qty', v_available_qty
        )
      );
      
      RAISE NOTICE '✅ تم التحقق من توفر المنتج: % - اللون: % - الحجم: % - الكمية المتوفرة: %', 
                   v_product_name, COALESCE(v_color_name, 'افتراضي'), 
                   COALESCE(v_size_name, 'افتراضي'), v_available_qty;
    END;
  END LOOP;
  
  -- التأكد من وجود منتجات قبل الإرجاع
  IF jsonb_array_length(v_final_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_products_found',
      'message', '⚠️ لم يتم العثور على منتجات متطابقة في طلبك. يرجى التحقق من أسماء المنتجات وإعادة المحاولة.'
    );
  END IF;
  
  RAISE NOTICE '✅ انتهاء الاستخراج بنجاح: % عنصر', jsonb_array_length(v_final_items);
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
      'message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة.'
    );
END;
$function$;