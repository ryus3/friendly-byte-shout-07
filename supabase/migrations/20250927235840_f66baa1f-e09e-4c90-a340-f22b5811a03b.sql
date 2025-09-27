-- إصلاح شامل لنظام البوت لمعالجة الطلبات بشكل صحيح

-- أولاً: إعادة كتابة دالة استخراج المنتجات من النص
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
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
  v_variant record;
  v_inventory record;
  v_price numeric := 0;
  v_alternatives jsonb := '[]';
  v_normalized_word text;
  v_product_id uuid;
  v_color_id uuid;
  v_size_id uuid;
  v_final_items jsonb := '[]';
  v_temp_product jsonb;
  v_temp_color jsonb;
  v_temp_size jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE 'بدء استخراج المنتجات من النص: %', input_text;
  
  -- تقسيم النص إلى كلمات وتطبيع النص
  v_words := string_to_array(lower(trim(input_text)), ' ');
  
  -- البحث عن المنتجات بطريقة محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    -- تخطي الكلمات القصيرة جداً
    IF length(v_normalized_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- البحث في أسماء المنتجات مع مرادفات محسنة
    FOR v_product IN 
      SELECT id, name, price, cost_price 
      FROM products 
      WHERE (
        lower(name) ILIKE '%' || v_normalized_word || '%' 
        OR lower(name) ILIKE '%ارجنتين%' AND v_normalized_word = 'ارجنتين'
        OR lower(name) ILIKE '%برشلونة%' AND v_normalized_word = 'برشلونة'
        OR lower(name) ILIKE '%ريال%' AND v_normalized_word = 'ريال'
        OR lower(name) ILIKE '%اياكس%' AND v_normalized_word = 'اياكس'
        OR lower(name) ILIKE '%باريس%' AND v_normalized_word = 'باريس'
        OR lower(name) ILIKE '%مانشستر%' AND v_normalized_word = 'مانشستر'
        OR lower(name) ILIKE '%ليفربول%' AND v_normalized_word = 'ليفربول'
        OR lower(name) ILIKE '%تشيلسي%' AND v_normalized_word = 'تشيلسي'
        OR lower(name) ILIKE '%مان%' AND v_normalized_word = 'مان'
      )
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          WHEN lower(name) ILIKE v_normalized_word || '%' THEN 2
          WHEN lower(name) ILIKE '%' || v_normalized_word || '%' THEN 3
          ELSE 4
        END
      LIMIT 1
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'price', COALESCE(v_product.price, 0),
        'cost_price', COALESCE(v_product.cost_price, 0)
      );
      
      -- تجنب التكرار
      IF NOT (v_temp_product = ANY(SELECT jsonb_array_elements(v_found_products))) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
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
      WHERE (
        lower(name) ILIKE '%' || v_normalized_word || '%'
        OR (lower(name) = 'ازرق' AND v_normalized_word IN ('سمائي', 'أزرق', 'ازرق'))
        OR (lower(name) = 'بني' AND v_normalized_word IN ('أسمر', 'اسمر', 'بني'))
        OR (lower(name) = 'رمادي' AND v_normalized_word IN ('فضي', 'رمادي', 'سيلفر'))
        OR (lower(name) = 'اسود' AND v_normalized_word IN ('أسود', 'اسود', 'black'))
        OR (lower(name) = 'ابيض' AND v_normalized_word IN ('أبيض', 'ابيض', 'white'))
        OR (lower(name) = 'احمر' AND v_normalized_word IN ('أحمر', 'احمر', 'red'))
        OR (lower(name) = 'اخضر' AND v_normalized_word IN ('أخضر', 'اخضر', 'green'))
        OR (lower(name) = 'اصفر' AND v_normalized_word IN ('أصفر', 'اصفر', 'yellow'))
        OR (lower(name) = 'بنفسجي' AND v_normalized_word IN ('بنفسجي', 'موف', 'purple'))
        OR (lower(name) = 'وردي' AND v_normalized_word IN ('وردي', 'pink', 'زهري'))
      )
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          WHEN lower(name) ILIKE v_normalized_word || '%' THEN 2
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_color := jsonb_build_object(
        'id', v_color.id,
        'name', v_color.name
      );
      
      IF NOT (v_temp_color = ANY(SELECT jsonb_array_elements(v_found_colors))) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
        RAISE NOTICE 'تم العثور على اللون: % (ID: %)', v_color.name, v_color.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الأحجام مع مرادفات محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    FOR v_size IN 
      SELECT id, name 
      FROM sizes 
      WHERE (
        lower(name) = v_normalized_word
        OR (lower(name) = 's' AND v_normalized_word IN ('s', 'small', 'صغير'))
        OR (lower(name) = 'm' AND v_normalized_word IN ('m', 'medium', 'متوسط', 'ميديم'))
        OR (lower(name) = 'l' AND v_normalized_word IN ('l', 'large', 'كبير', 'لارج'))
        OR (lower(name) = 'xl' AND v_normalized_word IN ('xl', 'xlarge', 'اكس لارج'))
        OR (lower(name) = 'xxl' AND v_normalized_word IN ('xxl', 'xxlarge', 'دبل اكس'))
      )
      ORDER BY 
        CASE 
          WHEN lower(name) = v_normalized_word THEN 1
          ELSE 2
        END
      LIMIT 1
    LOOP
      v_temp_size := jsonb_build_object(
        'id', v_size.id,
        'name', v_size.name
      );
      
      IF NOT (v_temp_size = ANY(SELECT jsonb_array_elements(v_found_sizes))) THEN
        v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
        RAISE NOTICE 'تم العثور على الحجم: % (ID: %)', v_size.name, v_size.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- إنشاء عناصر المنتجات
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    v_product_id := (v_current_item->>'id')::uuid;
    v_price := COALESCE((v_current_item->>'price')::numeric, 0);
    
    -- استخدام اللون والحجم الأول إذا وجد، أو البحث عن متغير افتراضي
    v_color_id := NULL;
    v_size_id := NULL;
    
    IF jsonb_array_length(v_found_colors) > 0 THEN
      v_color_id := (v_found_colors->0->>'id')::uuid;
    END IF;
    
    IF jsonb_array_length(v_found_sizes) > 0 THEN
      v_size_id := (v_found_sizes->0->>'id')::uuid;
    END IF;
    
    -- البحث عن متغير المنتج
    SELECT pv.*, i.quantity as stock_quantity INTO v_variant
    FROM product_variants pv
    LEFT JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.product_id = v_product_id
      AND (v_color_id IS NULL OR pv.color_id = v_color_id)
      AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      AND pv.is_active = true
    ORDER BY 
      CASE 
        WHEN pv.color_id = v_color_id AND pv.size_id = v_size_id THEN 1
        WHEN pv.color_id = v_color_id THEN 2
        WHEN pv.size_id = v_size_id THEN 3
        ELSE 4
      END,
      i.quantity DESC
    LIMIT 1;
    
    -- إذا لم يوجد متغير محدد، أخذ أول متغير متاح
    IF v_variant.id IS NULL THEN
      SELECT pv.*, i.quantity as stock_quantity INTO v_variant
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = v_product_id
        AND pv.is_active = true
      ORDER BY i.quantity DESC NULLS LAST
      LIMIT 1;
    END IF;
    
    -- بناء عنصر المنتج النهائي
    v_final_items := v_final_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', COALESCE(v_variant.id, null),
        'product_name', v_current_item->>'name',
        'color_name', COALESCE(
          (SELECT name FROM colors WHERE id = v_variant.color_id),
          (v_found_colors->0->>'name'),
          'افتراضي'
        ),
        'size_name', COALESCE(
          (SELECT name FROM sizes WHERE id = v_variant.size_id),
          (v_found_sizes->0->>'name'),
          'افتراضي'
        ),
        'quantity', v_quantity,
        'price', COALESCE(v_variant.price, v_price, 0),
        'total_price', COALESCE(v_variant.price, v_price, 0) * v_quantity,
        'stock_available', COALESCE(v_variant.stock_quantity, 0),
        'in_stock', COALESCE(v_variant.stock_quantity, 0) > 0
      )
    );
    
    RAISE NOTICE 'تم إنشاء عنصر المنتج: %', v_current_item->>'name';
  END LOOP;
  
  RAISE NOTICE 'تم إنشاء % عنصر منتج نهائي', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;

-- ثانياً: إعادة كتابة دالة معالجة طلبات التليغرام
CREATE OR REPLACE FUNCTION public.process_telegram_order_detailed(
  p_message_text text,
  p_chat_id bigint,
  p_telegram_user_id bigint DEFAULT NULL,
  p_telegram_username text DEFAULT NULL
)
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
  v_product_items jsonb := '[]';
  v_current_item jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_customer_name text := NULL;
  v_temp_text text;
  v_ai_order_id uuid;
  v_final_result jsonb;
  v_response_message text := '';
  v_city_search_result record;
  v_region_search_result record;
  v_available_alternatives jsonb := '[]';
  v_needs_clarification boolean := false;
  v_creator_user_id uuid;
  v_line text;
  v_lines text[];
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء معالجة الطلب المفصل: %', p_message_text;
  
  -- تقسيم النص إلى كلمات وأسطر
  v_words := string_to_array(lower(trim(p_message_text)), ' ');
  v_lines := string_to_array(trim(p_message_text), E'\n');
  
  -- استخراج رقم الهاتف بطريقة محسنة
  v_temp_text := regexp_replace(p_message_text, '[^0-9+]', '', 'g');
  IF length(v_temp_text) >= 10 THEN
    -- تنظيف الرقم وإضافة الرمز العراقي إذا لم يكن موجوداً
    v_phone := CASE 
      WHEN v_temp_text ~ '^964' THEN v_temp_text
      WHEN v_temp_text ~ '^07' THEN '964' || substring(v_temp_text from 2)
      WHEN v_temp_text ~ '^7' THEN '964' || v_temp_text
      ELSE v_temp_text
    END;
    RAISE NOTICE '📱 تم العثور على رقم الهاتف: %', v_phone;
  END IF;
  
  -- البحث عن المدينة باستخدام الدالة المحسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_found_city_id IS NULL AND length(trim(v_word)) > 2 THEN
      SELECT city_id, city_name, confidence INTO v_city_search_result
      FROM smart_search_city(v_word) 
      WHERE confidence >= 0.8
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_city_search_result.city_id IS NOT NULL THEN
        v_found_city_id := v_city_search_result.city_id;
        v_found_city_name := v_city_search_result.city_name;
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city_name, v_found_city_id;
      END IF;
    END IF;
  END LOOP;
  
  -- البحث عن المنطقة
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_found_region_id IS NULL AND length(trim(v_word)) > 2 THEN
      SELECT region_id, region_name, city_id, city_name, match_type, confidence 
      INTO v_region_search_result
      FROM smart_search_region(v_word, v_found_city_id) 
      WHERE confidence >= 0.8
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_region_search_result.region_id IS NOT NULL THEN
        v_found_region_id := v_region_search_result.region_id;
        v_found_region_name := v_region_search_result.region_name;
        
        -- إذا وجدت المنطقة مدينة مختلفة، استخدمها
        IF v_found_city_id IS NULL AND v_region_search_result.city_id IS NOT NULL THEN
          v_found_city_id := v_region_search_result.city_id;
          v_found_city_name := v_region_search_result.city_name;
        END IF;
        
        RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region_name, v_found_region_id;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج عناصر المنتجات
  SELECT extract_product_items_from_text(p_message_text) INTO v_product_items;
  RAISE NOTICE '🛍️ تم استخراج % عنصر من المنتجات', jsonb_array_length(v_product_items);
  
  -- حساب المبلغ الإجمالي
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_current_item->>'total_price')::numeric, 0);
  END LOOP;
  
  -- تحديد اسم العميل من أول سطر أو كلمة غير رقمية
  IF array_length(v_lines, 1) > 0 THEN
    v_customer_name := trim(split_part(v_lines[1], E'\n', 1));
    -- إزالة أرقام الهاتف من الاسم
    v_customer_name := trim(regexp_replace(v_customer_name, '[0-9+\s-]+', ' ', 'g'));
    -- أخذ أول كلمة معقولة
    v_customer_name := trim(split_part(v_customer_name, ' ', 1));
  END IF;
  
  -- تنظيف اسم العميل
  IF v_customer_name IS NULL OR length(trim(v_customer_name)) < 2 THEN
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF v_customer_name IS NULL AND length(v_word) > 2 AND v_word !~ '[0-9]' 
         AND v_word != COALESCE(lower(v_found_city_name), '') 
         AND v_word != COALESCE(lower(v_found_region_name), '') THEN
        v_customer_name := initcap(v_word);
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- الحصول على معرف المستخدم المنشئ (يجب ربطه بالتليغرام)
  SELECT user_id INTO v_creator_user_id
  FROM employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id 
    AND is_active = true
  LIMIT 1;
  
  -- إذا لم يوجد مستخدم مرتبط، استخدم المدير الافتراضي
  IF v_creator_user_id IS NULL THEN
    v_creator_user_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  END IF;
  
  -- إنشاء معرف طلب الذكي
  v_ai_order_id := gen_random_uuid();
  
  -- إدراج الطلب في جدول ai_orders
  INSERT INTO ai_orders (
    id,
    customer_name,
    customer_phone,
    customer_city,
    customer_region,
    customer_address,
    city_id,
    region_id,
    items,
    total_amount,
    source,
    telegram_chat_id,
    original_text,
    status,
    created_by,
    order_data
  ) VALUES (
    v_ai_order_id,
    COALESCE(v_customer_name, 'عميل'),
    v_phone,
    v_found_city_name,
    v_found_region_name,
    p_message_text,
    v_found_city_id,
    v_found_region_id,
    v_product_items,
    v_total_amount + v_delivery_fee,
    'telegram',
    p_chat_id,
    p_message_text,
    'pending',
    v_creator_user_id,
    jsonb_build_object(
      'telegram_user_id', p_telegram_user_id,
      'telegram_username', p_telegram_username,
      'total_amount', v_total_amount + v_delivery_fee,
      'subtotal', v_total_amount,
      'delivery_fee', v_delivery_fee
    )
  );
  
  RAISE NOTICE '✅ تم حفظ الطلب في قاعدة البيانات بالمعرف: %', v_ai_order_id;
  
  -- بناء رسالة الرد المفصلة
  v_response_message := '✅ تم استلام الطلب!' || E'\n\n';
  
  -- معلومات العميل والموقع
  v_response_message := v_response_message || '📍 ' || 
    COALESCE(v_found_city_name, 'غير محدد') || ' - ' || 
    COALESCE(v_found_region_name, 'غير محدد') || E'\n';
  
  IF v_phone IS NOT NULL THEN
    v_response_message := v_response_message || '📱 ' || v_phone || E'\n';
  END IF;
  
  -- عرض المنتجات
  IF jsonb_array_length(v_product_items) > 0 THEN
    FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_product_items)
    LOOP
      v_response_message := v_response_message || '🛍️ ' || 
        (v_current_item->>'product_name') || 
        CASE 
          WHEN (v_current_item->>'color_name') != 'افتراضي' THEN ' (' || (v_current_item->>'color_name') || ')'
          ELSE ''
        END ||
        CASE 
          WHEN (v_current_item->>'size_name') != 'افتراضي' THEN ' ' || (v_current_item->>'size_name')
          ELSE ''
        END ||
        ' × ' || (v_current_item->>'quantity') || E'\n';
    END LOOP;
  END IF;
  
  -- المبلغ الإجمالي
  v_response_message := v_response_message || '💵 المبلغ الاجمالي : ' || 
    trim(to_char(v_total_amount + v_delivery_fee, '999,999,999')) || ' د.ع';
  
  -- بناء النتيجة النهائية
  v_final_result := jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'response_message', v_response_message,
    'formatted_amount', trim(to_char(v_total_amount + v_delivery_fee, '999,999,999')) || ' د.ع',
    'customer_name', COALESCE(v_customer_name, 'عميل'),
    'customer_phone', v_phone,
    'customer_city', v_found_city_name,
    'customer_region', v_found_region_name,
    'city_id', v_found_city_id,
    'region_id', v_found_region_id,
    'customer_address', p_message_text,
    'items', v_product_items,
    'subtotal', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'total_amount', v_total_amount + v_delivery_fee,
    'available_alternatives', v_available_alternatives,
    'needs_product_clarification', jsonb_array_length(v_product_items) = 0,
    'error_type', NULL
  );
  
  -- إضافة تحذيرات إذا لزم الأمر
  IF v_found_city_id IS NULL THEN
    v_final_result := jsonb_set(v_final_result, '{needs_city_selection}', 'true');
    v_final_result := jsonb_set(v_final_result, '{response_message}', 
      '"⚠️ لم يتم التعرف على المدينة. يرجى تحديد المدينة من القائمة أدناه:"');
  END IF;
  
  IF v_found_region_id IS NULL AND v_found_city_id IS NOT NULL THEN
    v_final_result := jsonb_set(v_final_result, '{needs_region_selection}', 'true');
    v_final_result := jsonb_set(v_final_result, '{response_message}', 
      '"⚠️ لم يتم التعرف على المنطقة. يرجى تحديد المنطقة من القائمة أدناه:"');
  END IF;
  
  IF jsonb_array_length(v_product_items) = 0 THEN
    v_final_result := jsonb_set(v_final_result, '{response_message}', 
      '"⚠️ لم يتم التعرف على أي منتجات في الطلب. يرجى إعادة كتابة الطلب مع ذكر اسم المنتج بوضوح."');
  END IF;
  
  RAISE NOTICE '✅ انتهاء المعالجة بنجاح: %', v_final_result;
  RETURN v_final_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'error_type', 'system_error',
      'details', SQLERRM,
      'response_message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة أو التواصل مع الدعم.'
    );
END;
$function$;