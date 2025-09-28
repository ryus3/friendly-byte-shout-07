-- إضافة دالة محسنة لاستخراج المنتجات مع فحص التوفر والرسائل الذكية
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
  v_variant record;
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
  v_availability_error text := '';
  v_available_combinations text := '';
  v_target_product_name text;
  v_target_color_name text;
  v_target_size_name text;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات مع فحص التوفر من النص: %', input_text;
  
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
        v_target_color_name := v_color.name;
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
            v_target_size_name := v_size.name;
            RAISE NOTICE '📏 تم العثور على الحجم: % (ID: %)', v_size.name, v_size.id;
          END IF;
        END LOOP;
      END;
    END IF;
  END LOOP;
  
  -- فحص التوفر والبناء النهائي للعناصر
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
    BEGIN
      -- استخراج اللون والحجم المطلوبين
      IF jsonb_array_length(v_found_colors) > 0 THEN
        v_color_id := ((v_found_colors->0)->>'id')::uuid;
        v_color_name := (v_found_colors->0)->>'name';
      END IF;
      
      IF jsonb_array_length(v_found_sizes) > 0 THEN
        v_size_id := ((v_found_sizes->0)->>'id')::uuid;
        v_size_name := (v_found_sizes->0)->>'name';
      END IF;
      
      -- البحث عن التركيبة المطلوبة
      FOR v_variant IN 
        SELECT pv.id, pv.price, pv.cost_price, c.name as color_name, s.name as size_name,
               COALESCE(i.quantity, 0) as available_qty
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product_id
          AND (v_color_id IS NULL OR pv.color_id = v_color_id)
          AND (v_size_id IS NULL OR pv.size_id = v_size_id)
          AND pv.is_active = true
        ORDER BY COALESCE(i.quantity, 0) DESC
        LIMIT 1
      LOOP
        v_variant_found := true;
        v_unit_price := COALESCE(v_variant.price, (v_current_item->>'base_price')::numeric, 0);
        v_total_price := v_unit_price + v_delivery_fee;
        
        -- إنشاء العنصر المطلوب
        v_final_items := v_final_items || jsonb_build_array(jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_product_name,
          'color_id', v_color_id,
          'color', COALESCE(v_variant.color_name, v_color_name),
          'size_id', v_size_id,
          'size', COALESCE(v_variant.size_name, v_size_name),
          'quantity', v_quantity,
          'unit_price', v_unit_price,
          'delivery_fee', v_delivery_fee,
          'total_price', v_total_price,
          'available_qty', v_variant.available_qty
        ));
        
        RAISE NOTICE '✅ تم إنشاء عنصر: % - % - %', v_product_name, 
          COALESCE(v_variant.color_name, 'بدون لون'), 
          COALESCE(v_variant.size_name, 'بدون حجم');
      END LOOP;
      
      -- إذا لم توجد التركيبة المطلوبة، جمع البدائل المتوفرة
      IF NOT v_variant_found THEN
        DECLARE
          v_available_variants text := '';
          v_color_groups jsonb := '{}';
          v_color_key text;
          v_sizes_array jsonb;
        BEGIN
          -- جمع التركيبات المتوفرة مجمعة حسب اللون
          FOR v_variant IN 
            SELECT DISTINCT 
              COALESCE(c.name, 'بدون لون') as color_name,
              COALESCE(s.name, 'حجم افتراضي') as size_name,
              COALESCE(i.quantity, 0) as available_qty
            FROM product_variants pv
            LEFT JOIN colors c ON pv.color_id = c.id
            LEFT JOIN sizes s ON pv.size_id = s.id
            LEFT JOIN inventory i ON pv.id = i.variant_id
            WHERE pv.product_id = v_product_id 
              AND pv.is_active = true
              AND COALESCE(i.quantity, 0) > 0
            ORDER BY c.name, s.name
          LOOP
            v_color_key := v_variant.color_name;
            
            -- إضافة الحجم لمجموعة الألوان
            IF v_color_groups ? v_color_key THEN
              v_sizes_array := v_color_groups->v_color_key;
            ELSE
              v_sizes_array := '[]'::jsonb;
            END IF;
            
            v_sizes_array := v_sizes_array || jsonb_build_array(v_variant.size_name);
            v_color_groups := jsonb_set(v_color_groups, ARRAY[v_color_key], v_sizes_array);
          END LOOP;
          
          -- بناء رسالة البدائل المتوفرة
          FOR v_color_key IN SELECT * FROM jsonb_object_keys(v_color_groups)
          LOOP
            IF v_available_variants != '' THEN
              v_available_variants := v_available_variants || '، ';
            END IF;
            
            DECLARE
              v_sizes_list text := '';
              v_size_item text;
            BEGIN
              FOR v_size_item IN 
                SELECT DISTINCT jsonb_array_elements_text(v_color_groups->v_color_key)
                ORDER BY 1
              LOOP
                IF v_sizes_list != '' THEN
                  v_sizes_list := v_sizes_list || '، ';
                END IF;
                v_sizes_list := v_sizes_list || v_size_item;
              END LOOP;
              
              v_available_variants := v_available_variants || v_color_key || ' (' || v_sizes_list || ')';
            END;
          END LOOP;
          
          -- إنشاء رسالة الخطأ
          v_availability_error := format(
            '❌ فشل في إنشاء الطلب: المنتج "%s" غير متوفر باللون "%s" والحجم "%s".' || E'\n\n' ||
            'المتوفر فعلياً: %s',
            v_product_name,
            COALESCE(v_target_color_name, 'غير محدد'),
            COALESCE(v_target_size_name, 'غير محدد'),
            COALESCE(NULLIF(v_available_variants, ''), 'لا توجد تركيبات متوفرة')
          );
          
          RAISE NOTICE '⚠️ المنتج غير متوفر: %', v_availability_error;
        END;
      END IF;
    END;
  END LOOP;
  
  -- إرجاع النتيجة النهائية
  IF v_availability_error != '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_not_available',
      'message', v_availability_error,
      'items', '[]'::jsonb
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'items', v_final_items
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في فحص توفر المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '⚠️ عذراً، حدث خطأ في فحص توفر المنتجات.',
      'items', '[]'::jsonb
    );
END;
$function$;

-- تحديث دالة معالجة طلبات التليغرام لاستخدام الدالة المحسنة
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
  v_customer_name text := NULL;
  v_temp_text text;
  v_temp_id uuid;
  v_final_result jsonb;
  -- متغيرات منفصلة لنتائج البحث
  v_city_confidence numeric;
  v_region_confidence numeric;
  v_region_city_id integer;
  v_region_city_name text;
  v_region_match_type text;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء معالجة الرسالة: %', p_message_text;
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(lower(trim(p_message_text)), ' ');
  
  -- البحث عن رقم الهاتف
  v_temp_text := regexp_replace(p_message_text, '[^0-9+]', '', 'g');
  IF length(v_temp_text) >= 10 THEN
    v_phone := v_temp_text;
    RAISE NOTICE '📱 تم العثور على رقم الهاتف: %', v_phone;
  END IF;
  
  -- البحث عن المدينة والمنطقة
  FOREACH v_word IN ARRAY v_words
  LOOP
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
  END LOOP;
  
  -- استخراج عناصر المنتجات مع فحص التوفر
  SELECT extract_product_items_with_availability_check(p_message_text) INTO v_product_items_result;
  
  -- فحص النتيجة
  IF (v_product_items_result->>'success')::boolean = false THEN
    -- إرجاع رسالة الخطأ مع البدائل المتوفرة
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
  
  -- تحديد اسم العميل (أول كلمة غير رقمية وغير مدينة/منطقة)
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_customer_name IS NULL AND length(v_word) > 2 AND v_word !~ '[0-9]' 
       AND v_word != lower(v_found_city_name) AND v_word != lower(v_found_region_name) THEN
      v_customer_name := initcap(v_word);
      EXIT;
    END IF;
  END LOOP;
  
  -- بناء النتيجة النهائية
  v_final_result := jsonb_build_object(
    'success', true,
    'message', '✅ تم تحليل طلبك بنجاح! يرجى مراجعة التفاصيل والتأكيد.',
    'order_data', jsonb_build_object(
      'customer_name', COALESCE(v_customer_name, 'عميل'),
      'customer_phone', v_phone,
      'customer_city', v_found_city_name,
      'customer_province', v_found_region_name,  -- تم تغيير customer_region إلى customer_province
      'city_id', v_found_city_id,
      'region_id', v_found_region_id,
      'customer_address', p_message_text,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'source', 'telegram',
      'telegram_chat_id', p_chat_id,
      'original_text', p_message_text
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