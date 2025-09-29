-- إصلاح دالة process_telegram_order لتعمل مع الجداول الجسرية الصحيحة
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
  v_product_items jsonb := '[]';
  v_current_item jsonb;
  v_quantity integer := 1;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_customer_name text := NULL;
  v_temp_text text;
  v_temp_id uuid;
  v_final_result jsonb;
  v_normalized_text text;
  v_names_words text[] := '{}';
  v_product_colors text[] := '{}';
  v_product_sizes text[] := '{}';
  v_city_confidence numeric;
  v_region_confidence numeric;
  v_region_city_id integer;
  v_region_city_name text;
  v_region_match_type text;
  v_default_customer_name text := NULL;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة الرسالة: %', p_message_text;
  
  -- الحصول على الاسم الافتراضي للعميل من إعدادات المستخدم المرتبط
  SELECT user_id INTO v_temp_id 
  FROM employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id 
    AND is_active = true 
  LIMIT 1;
  
  -- الحصول على الاسم الافتراضي من إعدادات المستخدم
  IF v_temp_id IS NOT NULL THEN
    SELECT raw_user_meta_data->>'default_customer_name' INTO v_default_customer_name
    FROM auth.users 
    WHERE id = v_temp_id;
  END IF;
  
  -- إذا لم يوجد مستخدم مرتبط، استخدم المدير الافتراضي
  IF v_temp_id IS NULL THEN
    v_temp_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
    v_default_customer_name := 'ريوس';
  END IF;
  
  -- استخدام الاسم الافتراضي إذا كان متوفراً
  IF v_default_customer_name IS NOT NULL AND trim(v_default_customer_name) != '' THEN
    v_customer_name := trim(v_default_customer_name);
  ELSE
    v_customer_name := 'ريوس';
  END IF;
  
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
  
  -- جمع الألوان والأحجام المتوفرة
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
  END LOOP;
  
  -- استخراج عناصر المنتجات بشكل صحيح
  v_product_items := extract_product_items_from_text(p_message_text);
  
  RAISE NOTICE '🛍️ تم استخراج % عنصر من المنتجات', jsonb_array_length(v_product_items);
  
  -- حساب المبلغ الإجمالي
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_current_item->>'total_price')::numeric, 0);
  END LOOP;
  
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
      'total_amount', v_total_amount + v_delivery_fee,
      'products_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
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

-- إصلاح دالة extract_product_items_from_text لتعمل مع الجداول الجسرية الصحيحة
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_items jsonb := '[]';
  v_words text[];
  v_word text;
  v_product_matches jsonb := '[]';
  v_color_matches text[] := '{}';
  v_size_matches text[] := '{}';
  v_final_items jsonb := '[]';
  v_current_quantity integer := 1;
  v_normalized_text text;
BEGIN
  -- تطبيع النص
  v_normalized_text := lower(trim(input_text));
  v_words := string_to_array(v_normalized_text, ' ');
  
  -- جمع الألوان المتوفرة
  SELECT array_agg(DISTINCT lower(name)) INTO v_color_matches 
  FROM colors WHERE name IS NOT NULL;
  
  -- جمع الأحجام المتوفرة
  SELECT array_agg(DISTINCT lower(name)) INTO v_size_matches 
  FROM sizes WHERE name IS NOT NULL;
  
  -- البحث عن المنتجات باستخدام الجداول الجسرية الصحيحة
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'base_price', p.base_price,
      'cost_price', p.cost_price,
      'department_name', COALESCE(d.name, 'غير محدد'),
      'category_name', COALESCE(c.name, 'غير محدد'),
      'product_type_name', COALESCE(pt.name, 'غير محدد'),
      'season_name', COALESCE(so.name, 'غير محدد'),
      'variants', COALESCE(
        (SELECT jsonb_agg(
          jsonb_build_object(
            'variant_id', pv.id,
            'sku', pv.sku,
            'color_name', COALESCE(col.name, 'افتراضي'),
            'size_name', COALESCE(sz.name, 'افتراضي'),
            'price', COALESCE(pv.price, p.base_price),
            'cost_price', COALESCE(pv.cost_price, p.cost_price),
            'inventory_quantity', COALESCE(inv.quantity, 0)
          )
        ) FROM product_variants pv
        LEFT JOIN colors col ON pv.color_id = col.id
        LEFT JOIN sizes sz ON pv.size_id = sz.id
        LEFT JOIN inventory inv ON pv.id = inv.variant_id
        WHERE pv.product_id = p.id),
        '[]'::jsonb
      )
    )
  ) INTO v_product_matches
  FROM products p
  LEFT JOIN product_departments pd ON p.id = pd.product_id
  LEFT JOIN departments d ON pd.department_id = d.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN categories c ON pc.category_id = c.id
  LEFT JOIN product_product_types ppt ON p.id = ppt.product_id
  LEFT JOIN product_types pt ON ppt.product_type_id = pt.id
  LEFT JOIN product_seasons_occasions pso ON p.id = pso.product_id
  LEFT JOIN seasons_occasions so ON pso.season_occasion_id = so.id
  WHERE p.is_active = true
    AND EXISTS (
      SELECT 1 FROM unnest(v_words) AS word
      WHERE lower(p.name) LIKE '%' || word || '%'
        OR lower(COALESCE(d.name, '')) LIKE '%' || word || '%'
        OR lower(COALESCE(c.name, '')) LIKE '%' || word || '%'
        OR lower(COALESCE(pt.name, '')) LIKE '%' || word || '%'
        OR lower(COALESCE(so.name, '')) LIKE '%' || word || '%'
    );
  
  -- معالجة المنتجات المطابقة وإنشاء العناصر النهائية
  IF v_product_matches IS NOT NULL AND jsonb_array_length(v_product_matches) > 0 THEN
    DECLARE
      v_product_item jsonb;
      v_best_variant jsonb;
      v_found_color text := NULL;
      v_found_size text := NULL;
      v_item_price numeric;
      v_item_cost numeric;
    BEGIN
      FOR v_product_item IN SELECT * FROM jsonb_array_elements(v_product_matches)
      LOOP
        -- البحث عن اللون والحجم في النص
        FOREACH v_word IN ARRAY v_words
        LOOP
          IF v_word = ANY(v_color_matches) AND v_found_color IS NULL THEN
            v_found_color := v_word;
          END IF;
          IF v_word = ANY(v_size_matches) AND v_found_size IS NULL THEN
            v_found_size := v_word;
          END IF;
        END LOOP;
        
        -- العثور على أفضل متغير مطابق
        SELECT variant INTO v_best_variant
        FROM jsonb_array_elements(v_product_item->'variants') AS variant
        WHERE (v_found_color IS NULL OR lower(variant->>'color_name') = v_found_color)
          AND (v_found_size IS NULL OR lower(variant->>'size_name') = v_found_size)
        ORDER BY (variant->>'inventory_quantity')::integer DESC
        LIMIT 1;
        
        -- إذا لم يوجد متغير مطابق، استخدم الأول المتوفر
        IF v_best_variant IS NULL THEN
          SELECT variant INTO v_best_variant
          FROM jsonb_array_elements(v_product_item->'variants') AS variant
          ORDER BY (variant->>'inventory_quantity')::integer DESC
          LIMIT 1;
        END IF;
        
        -- تحديد السعر والتكلفة
        IF v_best_variant IS NOT NULL THEN
          v_item_price := (v_best_variant->>'price')::numeric;
          v_item_cost := (v_best_variant->>'cost_price')::numeric;
        ELSE
          v_item_price := (v_product_item->>'base_price')::numeric;
          v_item_cost := (v_product_item->>'cost_price')::numeric;
        END IF;
        
        -- إضافة العنصر إلى القائمة النهائية
        v_final_items := v_final_items || jsonb_build_array(
          jsonb_build_object(
            'product_id', v_product_item->>'product_id',
            'product_name', v_product_item->>'product_name',
            'variant_id', COALESCE(v_best_variant->>'variant_id', null),
            'variant_sku', COALESCE(v_best_variant->>'sku', ''),
            'color_name', COALESCE(v_best_variant->>'color_name', 'افتراضي'),
            'size_name', COALESCE(v_best_variant->>'size_name', 'افتراضي'),
            'quantity', v_current_quantity,
            'unit_price', v_item_price,
            'unit_cost', v_item_cost,
            'total_price', v_item_price * v_current_quantity,
            'total_cost', v_item_cost * v_current_quantity,
            'department_name', v_product_item->>'department_name',
            'category_name', v_product_item->>'category_name',
            'product_type_name', v_product_item->>'product_type_name',
            'season_name', v_product_item->>'season_name',
            'inventory_quantity', COALESCE((v_best_variant->>'inventory_quantity')::integer, 0)
          )
        );
        
        -- إعادة تعيين المتغيرات للمنتج التالي
        v_found_color := NULL;
        v_found_size := NULL;
      END LOOP;
    END;
  END IF;
  
  RAISE NOTICE '🛍️ تم استخراج % عنصر من النص', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;