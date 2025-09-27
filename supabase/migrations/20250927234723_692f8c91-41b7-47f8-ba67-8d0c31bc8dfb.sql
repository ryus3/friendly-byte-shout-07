-- إصلاح دالة استخراج المنتجات من النص
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
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
  v_found_products text[] := '{}';
  v_found_colors text[] := '{}';
  v_found_sizes text[] := '{}';
  v_variant record;
  v_inventory record;
  v_price numeric := 0;
  v_alternatives jsonb := '[]';
  v_normalized_word text;
  v_product_id uuid;
  v_color_id uuid;
  v_size_id uuid;
  v_final_items jsonb := '[]';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE 'بدء استخراج المنتجات من النص: %', input_text;
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(lower(trim(input_text)), ' ');
  
  -- البحث عن المنتجات أولاً
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث في أسماء المنتجات
    FOR v_product IN 
      SELECT id, name, price, cost_price 
      FROM products 
      WHERE lower(name) LIKE '%' || v_word || '%' 
        AND is_active = true
      ORDER BY 
        CASE 
          WHEN lower(name) = lower(v_word) THEN 1
          WHEN lower(name) LIKE lower(v_word) || '%' THEN 2
          ELSE 3
        END
    LOOP
      IF NOT (v_product.name = ANY(v_found_products)) THEN
        v_found_products := array_append(v_found_products, v_product.name);
        v_product_id := v_product.id;
        RAISE NOTICE 'تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان مع مرادفات محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    -- البحث المباشر في الألوان
    FOR v_color IN 
      SELECT id, name 
      FROM colors 
      WHERE lower(name) = v_normalized_word 
         OR lower(name) LIKE '%' || v_normalized_word || '%'
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          WHEN lower(name) LIKE v_normalized_word || '%' THEN 2
          ELSE 3
        END
    LOOP
      IF NOT (v_color.name = ANY(v_found_colors)) THEN
        v_found_colors := array_append(v_found_colors, v_color.name);
        v_color_id := v_color.id;
        RAISE NOTICE 'تم العثور على اللون: % (ID: %)', v_color.name, v_color.id;
      END IF;
    END LOOP;
    
    -- مرادفات الألوان الشائعة
    IF v_normalized_word = 'سمائي' THEN 
      FOR v_color IN SELECT id, name FROM colors WHERE lower(name) = 'ازرق' LOOP
        IF NOT (v_color.name = ANY(v_found_colors)) THEN 
          v_found_colors := array_append(v_found_colors, v_color.name);
          v_color_id := v_color.id;
          RAISE NOTICE 'تم العثور على اللون (مرادف): % (ID: %)', v_color.name, v_color.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word = 'أسمر' THEN 
      FOR v_color IN SELECT id, name FROM colors WHERE lower(name) = 'بني' LOOP
        IF NOT (v_color.name = ANY(v_found_colors)) THEN 
          v_found_colors := array_append(v_found_colors, v_color.name);
          v_color_id := v_color.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word = 'فضي' THEN 
      FOR v_color IN SELECT id, name FROM colors WHERE lower(name) = 'رمادي' LOOP
        IF NOT (v_color.name = ANY(v_found_colors)) THEN 
          v_found_colors := array_append(v_found_colors, v_color.name);
          v_color_id := v_color.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word = 'ذهبي' THEN 
      FOR v_color IN SELECT id, name FROM colors WHERE lower(name) = 'أصفر' LOOP
        IF NOT (v_color.name = ANY(v_found_colors)) THEN 
          v_found_colors := array_append(v_found_colors, v_color.name);
          v_color_id := v_color.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word IN ('نبيتي', 'كحلي', 'نيفي') THEN 
      FOR v_color IN SELECT id, name FROM colors WHERE lower(name) = 'ازرق' LOOP
        IF NOT (v_color.name = ANY(v_found_colors)) THEN 
          v_found_colors := array_append(v_found_colors, v_color.name);
          v_color_id := v_color.id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  -- البحث عن الأحجام مع مرادفات محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    -- البحث المباشر في الأحجام
    FOR v_size IN 
      SELECT id, name 
      FROM sizes 
      WHERE lower(name) = v_normalized_word
      ORDER BY name
    LOOP
      IF NOT (v_size.name = ANY(v_found_sizes)) THEN
        v_found_sizes := array_append(v_found_sizes, v_size.name);
        v_size_id := v_size.id;
        RAISE NOTICE 'تم العثور على الحجم: % (ID: %)', v_size.name, v_size.id;
      END IF;
    END LOOP;
    
    -- مرادفات الأحجام الشائعة (استخدام IF-ELSIF بدلاً من CASE)
    IF v_normalized_word IN ('صغير', 'سمول') THEN 
      FOR v_size IN SELECT id, name FROM sizes WHERE lower(name) = 's' LOOP
        IF NOT (v_size.name = ANY(v_found_sizes)) THEN 
          v_found_sizes := array_append(v_found_sizes, v_size.name);
          v_size_id := v_size.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word IN ('متوسط', 'ميديم', 'وسط') THEN 
      FOR v_size IN SELECT id, name FROM sizes WHERE lower(name) = 'm' LOOP
        IF NOT (v_size.name = ANY(v_found_sizes)) THEN 
          v_found_sizes := array_append(v_found_sizes, v_size.name);
          v_size_id := v_size.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word IN ('كبير', 'لارج') THEN 
      FOR v_size IN SELECT id, name FROM sizes WHERE lower(name) = 'l' LOOP
        IF NOT (v_size.name = ANY(v_found_sizes)) THEN 
          v_found_sizes := array_append(v_found_sizes, v_size.name);
          v_size_id := v_size.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word IN ('اكس لارج', 'كبير جداً', 'xl') THEN 
      FOR v_size IN SELECT id, name FROM sizes WHERE lower(name) = 'xl' LOOP
        IF NOT (v_size.name = ANY(v_found_sizes)) THEN 
          v_found_sizes := array_append(v_found_sizes, v_size.name);
          v_size_id := v_size.id;
        END IF;
      END LOOP;
    ELSIF v_normalized_word IN ('اكس اكس لارج', 'كبير جداً جداً', 'xxl') THEN 
      FOR v_size IN SELECT id, name FROM sizes WHERE lower(name) = 'xxl' LOOP
        IF NOT (v_size.name = ANY(v_found_sizes)) THEN 
          v_found_sizes := array_append(v_found_sizes, v_size.name);
          v_size_id := v_size.id;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- بناء المنتجات مع التحقق من التوفر
  IF array_length(v_found_products, 1) > 0 THEN
    -- للمنتج الأول الموجود
    SELECT id, name, price, cost_price 
    INTO v_product
    FROM products 
    WHERE name = v_found_products[1] AND is_active = true
    LIMIT 1;

    IF v_product.id IS NOT NULL THEN
      -- البحث عن الvariант المناسب
      SELECT pv.*, c.name as color_name, s.name as size_name
      INTO v_variant
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_product.id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      LIMIT 1;

      IF v_variant.id IS NOT NULL THEN
        -- التحقق من المخزون
        SELECT * INTO v_inventory
        FROM inventory
        WHERE variant_id = v_variant.id
        LIMIT 1;

        v_price := COALESCE(v_variant.price, v_product.price, 0);

        -- إضافة المنتج إلى النتيجة
        v_current_item := jsonb_build_object(
          'product_id', v_product.id,
          'product_name', v_product.name,
          'variant_id', v_variant.id,
          'color_name', COALESCE(v_variant.color_name, 'افتراضي'),
          'size_name', COALESCE(v_variant.size_name, 'افتراضي'),
          'quantity', v_quantity,
          'unit_price', v_price,
          'total_price', v_price * v_quantity,
          'available_quantity', COALESCE(v_inventory.quantity, 0),
          'is_available', COALESCE(v_inventory.quantity, 0) >= v_quantity
        );

        v_final_items := v_final_items || jsonb_build_array(v_current_item);
        
        RAISE NOTICE 'تم إضافة المنتج: % - %/%', v_product.name, v_variant.color_name, v_variant.size_name;
      ELSE
        -- إضافة منتج بدون تفاصيل محددة مع البدائل المتاحة
        SELECT jsonb_agg(
          jsonb_build_object(
            'color_name', c.name,
            'size_name', s.name,
            'price', COALESCE(pv.price, v_product.price, 0),
            'available_quantity', COALESCE(i.quantity, 0)
          )
        ) INTO v_alternatives
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product.id
          AND COALESCE(i.quantity, 0) > 0;

        v_current_item := jsonb_build_object(
          'product_id', v_product.id,
          'product_name', v_product.name,
          'variant_id', null,
          'color_name', COALESCE(v_found_colors[1], 'غير محدد'),
          'size_name', COALESCE(v_found_sizes[1], 'غير محدد'),
          'quantity', v_quantity,
          'unit_price', 0,
          'total_price', 0,
          'available_quantity', 0,
          'is_available', false,
          'alternatives', COALESCE(v_alternatives, '[]'::jsonb),
          'error_message', 'المنتج غير متوفر بالمواصفات المطلوبة'
        );

        v_final_items := v_final_items || jsonb_build_array(v_current_item);
      END IF;
    END IF;
  END IF;

  RAISE NOTICE 'انتهاء المعالجة، عدد العناصر: %', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;

-- تحسين دالة البحث الذكي عن المناطق
CREATE OR REPLACE FUNCTION public.smart_search_region(search_text text, city_id_filter integer DEFAULT NULL)
 RETURNS TABLE(region_id integer, region_name text, city_id integer, city_name text, match_type text, confidence numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  normalized_search text;
BEGIN
  normalized_search := lower(trim(search_text));
  
  RETURN QUERY
  SELECT 
    rc.id as region_id,
    rc.name as region_name,
    rc.city_id as city_id,
    cc.name as city_name,
    CASE 
      WHEN lower(rc.name) = normalized_search THEN 'exact_match'
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 'prefix_match'
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 'contains_match'
      ELSE 'partial_match'
    END as match_type,
    CASE 
      WHEN lower(rc.name) = normalized_search THEN 1.0
      WHEN lower(rc.name) LIKE normalized_search || '%' THEN 0.9
      WHEN lower(rc.name) LIKE '%' || normalized_search || '%' THEN 0.7
      WHEN normalized_search LIKE '%' || lower(rc.name) || '%' THEN 0.6
      ELSE 0.4
    END as confidence
  FROM regions_cache rc
  JOIN cities_cache cc ON rc.city_id = cc.id
  WHERE rc.is_active = true
    AND cc.is_active = true
    AND (city_id_filter IS NULL OR rc.city_id = city_id_filter)
    AND (
      lower(rc.name) = normalized_search
      OR lower(rc.name) LIKE '%' || normalized_search || '%'
      OR normalized_search LIKE '%' || lower(rc.name) || '%'
      -- إضافة بحث في الكلمات المفردة
      OR EXISTS (
        SELECT 1 FROM unnest(string_to_array(lower(rc.name), ' ')) AS word
        WHERE word LIKE '%' || normalized_search || '%'
      )
    )
  ORDER BY 
    CASE WHEN city_id_filter IS NOT NULL AND rc.city_id = city_id_filter THEN 1 ELSE 2 END,
    confidence DESC, 
    length(rc.name) ASC,
    rc.name
  LIMIT 10;
END;
$function$;

-- تحديث دالة معالجة طلبات التليغرام المفصلة
CREATE OR REPLACE FUNCTION public.process_telegram_order_detailed(p_message_text text, p_chat_id bigint)
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
  v_product_items jsonb := '[]';
  v_total_amount numeric := 0;
  v_customer_name text := NULL;
  v_temp_text text;
  v_ai_order_id uuid;
  v_final_result jsonb;
  v_delivery_fee numeric := 5000; -- رسوم التوصيل الافتراضية
  v_grand_total numeric := 0;
  v_success boolean := true;
  v_error_type text := NULL;
  v_needs_clarification boolean := false;
  v_available_alternatives jsonb := '[]';
  v_item jsonb;
  v_response_message text;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام مفصل: %', p_message_text;
  
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
      SELECT city_id, city_name, confidence 
      INTO v_found_city_id, v_found_city_name
      FROM smart_search_city(v_word) 
      WHERE confidence >= 0.7
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_city_id IS NOT NULL THEN
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city_name, v_found_city_id;
      END IF;
    END IF;
    
    -- البحث عن المنطقة
    IF v_found_region_id IS NULL THEN
      SELECT region_id, region_name, confidence
      INTO v_found_region_id, v_found_region_name
      FROM smart_search_region(v_word, v_found_city_id) 
      WHERE confidence >= 0.6
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_region_id IS NOT NULL THEN
        RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region_name, v_found_region_id;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج عناصر المنتجات
  SELECT extract_product_items_from_text(p_message_text) INTO v_product_items;
  RAISE NOTICE '🛍️ تم استخراج % عنصر من المنتجات', jsonb_array_length(v_product_items);
  
  -- حساب المبلغ الإجمالي وجمع البدائل
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = true THEN
      v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
    ELSE
      v_needs_clarification := true;
      v_error_type := 'missing_products';
      IF v_item ? 'alternatives' THEN
        v_available_alternatives := v_available_alternatives || (v_item->'alternatives');
      END IF;
    END IF;
  END LOOP;
  
  -- حساب المجموع الكلي مع التوصيل
  v_grand_total := v_total_amount + v_delivery_fee;
  
  -- تحديد اسم العميل
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_customer_name IS NULL AND length(v_word) > 2 AND v_word !~ '[0-9]' 
       AND lower(v_word) != lower(COALESCE(v_found_city_name, ''))
       AND lower(v_word) != lower(COALESCE(v_found_region_name, '')) THEN
      v_customer_name := initcap(v_word);
      EXIT;
    END IF;
  END LOOP;
  
  -- إنشاء سجل الطلب في ai_orders
  INSERT INTO ai_orders (
    customer_name, customer_phone, customer_city, customer_address,
    city_id, region_id, items, total_amount, source, telegram_chat_id,
    original_text, status, order_data
  ) VALUES (
    COALESCE(v_customer_name, 'عميل'),
    v_phone,
    v_found_city_name,
    p_message_text,
    v_found_city_id,
    v_found_region_id,
    v_product_items,
    v_grand_total,
    'telegram',
    p_chat_id,
    p_message_text,
    CASE WHEN v_needs_clarification THEN 'needs_clarification' ELSE 'pending' END,
    jsonb_build_object(
      'delivery_fee', v_delivery_fee,
      'subtotal', v_total_amount,
      'grand_total', v_grand_total,
      'needs_clarification', v_needs_clarification,
      'error_type', v_error_type
    )
  ) RETURNING id INTO v_ai_order_id;
  
  -- بناء رسالة الرد
  IF v_needs_clarification THEN
    v_response_message := '❌ فشل في إنشاء الطلب: ';
    
    -- إضافة تفاصيل المشاكل
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
    LOOP
      IF (v_item->>'is_available')::boolean = false THEN
        v_response_message := v_response_message || format(
          'المنتج "%s" غير متوفر باللون "%s" والحجم "%s". ',
          v_item->>'product_name',
          v_item->>'color_name', 
          v_item->>'size_name'
        );
      END IF;
    END LOOP;
    
    -- إضافة البدائل المتاحة
    IF jsonb_array_length(v_available_alternatives) > 0 THEN
      v_response_message := v_response_message || E'\n\nالمتوفر فعلياً: ';
      
      DECLARE
        v_alt jsonb;
        v_colors_sizes text := '';
      BEGIN
        FOR v_alt IN SELECT * FROM jsonb_array_elements(v_available_alternatives)
        LOOP
          IF v_colors_sizes != '' THEN
            v_colors_sizes := v_colors_sizes || '، ';
          END IF;
          v_colors_sizes := v_colors_sizes || format('%s (%s)', 
            v_alt->>'color_name', 
            v_alt->>'size_name'
          );
        END LOOP;
        
        v_response_message := v_response_message || v_colors_sizes;
      END;
    END IF;
  ELSE
    -- رسالة نجح
    v_response_message := format(
      '✅ تم استلام الطلب!' || E'\n' ||
      '📍%s - %s' || E'\n' ||
      '📱 الهاتف : %s' || E'\n',
      COALESCE(v_found_city_name, 'غير محدد'),
      COALESCE(v_found_region_name, 'غير محدد'),
      COALESCE(v_phone, 'غير محدد')
    );
    
    -- إضافة تفاصيل المنتجات
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
    LOOP
      IF (v_item->>'is_available')::boolean = true THEN
        v_response_message := v_response_message || format(
          '✅ %s (%s) %s × %s' || E'\n',
          v_item->>'product_name',
          v_item->>'color_name',
          v_item->>'size_name',
          v_item->>'quantity'
        );
      END IF;
    END LOOP;
    
    -- إضافة المبلغ الإجمالي
    v_response_message := v_response_message || format(
      '• المبلغ الاجمالي : %s د.ع',
      to_char(v_grand_total, 'FM999,999,999')
    );
  END IF;
  
  -- بناء النتيجة النهائية
  v_final_result := jsonb_build_object(
    'success', NOT v_needs_clarification,
    'ai_order_id', v_ai_order_id,
    'customer_name', COALESCE(v_customer_name, 'عميل'),
    'customer_phone', v_phone,
    'customer_city', v_found_city_name,
    'customer_region', v_found_region_name,
    'customer_address', p_message_text,
    'city_id', v_found_city_id,
    'region_id', v_found_region_id,
    'items', v_product_items,
    'total_amount', v_grand_total,
    'formatted_amount', CASE WHEN v_grand_total > 0 THEN to_char(v_grand_total, 'FM999,999,999') || ' د.ع' ELSE 'غير محدد' END,
    'delivery_fee', v_delivery_fee,
    'subtotal', v_total_amount,
    'needs_product_clarification', v_needs_clarification,
    'error_type', v_error_type,
    'response_message', v_response_message,
    'available_alternatives', v_available_alternatives
  );
  
  RAISE NOTICE '✅ نتيجة معالجة الطلب: %', v_final_result;
  RETURN v_final_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب المفصل: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'details', SQLERRM,
      'response_message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة أو التواصل مع الدعم.'
    );
END;
$function$;