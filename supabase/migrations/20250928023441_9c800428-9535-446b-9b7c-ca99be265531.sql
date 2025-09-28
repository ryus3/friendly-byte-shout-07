-- إصلاح دالة extract_product_items_with_availability_check لتوفير رسائل خطأ ذكية بالتنسيق المطلوب
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
  v_error_message text := '';
  v_alternatives_map jsonb := '{}';
  v_alternatives_text text := '';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات مع فحص التوفر من النص: %', input_text;
  
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_normalized_text := lower(trim(v_normalized_text));
  
  -- استخراج الكمية بطريقة محسنة
  SELECT GREATEST(
    COALESCE((regexp_match(input_text, 'عدد\s*(\d+)', 'i'))[1]::integer, 1),
    COALESCE((regexp_match(input_text, '(\d+)\s*(قطعة|حبة|قطع)', 'i'))[1]::integer, 1),
    COALESCE((regexp_match(input_text, '[×x]\s*(\d+)', 'i'))[1]::integer, 1),
    COALESCE((regexp_match(input_text, '\s(\d+)\s*$', 'i'))[1]::integer, 1),
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
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.product_id,
        'name', v_product.product_name,
        'base_price', v_product.base_price
      );
      v_found_products := v_found_products || v_temp_product;
      v_target_product_name := v_product.product_name;
      RAISE NOTICE '🛍️ تم العثور على المنتج: %', v_product.product_name;
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
      WHERE lower(c.name) = lower(v_word) 
         OR lower(c.name) ILIKE '%' || v_word || '%'
      ORDER BY 
        CASE 
          WHEN lower(c.name) = lower(v_word) THEN 1
          WHEN lower(c.name) ILIKE lower(v_word) || '%' THEN 2
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
      
      -- البحث عن variant مطابق بالضبط
      SELECT pv.id, pv.price, 
             COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_qty
      INTO v_variant_id, v_variant_price, v_variant_qty
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      ORDER BY (pv.color_id IS NOT NULL)::int DESC, (pv.size_id IS NOT NULL)::int DESC
      LIMIT 1;
      
      -- فحص التوفر وإرجاع رسالة خطأ ذكية إذا لم يكن متوفراً
      IF v_variant_id IS NULL OR COALESCE(v_variant_qty, 0) < v_quantity THEN
        -- بناء رسالة خطأ ذكية
        v_error_message := '❌ فشل في إنشاء الطلب: المنتج "' || v_product_name || '"';
        
        IF v_color_name IS NOT NULL AND v_size_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر باللون "' || v_color_name || '" والحجم "' || v_size_name || '".';
        ELSIF v_color_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر باللون "' || v_color_name || '".';
        ELSIF v_size_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر بالحجم "' || v_size_name || '".';
        ELSE
          v_error_message := v_error_message || ' غير متوفر حالياً.';
        END IF;
        
        -- جمع البدائل المتوفرة بالتنسيق المطلوب: لون (أحجام)
        WITH available_variants AS (
          SELECT 
            COALESCE(c.name, '') as color_name,
            COALESCE(s.name, '') as size_name,
            COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_qty
          FROM product_variants pv
          LEFT JOIN colors c ON pv.color_id = c.id
          LEFT JOIN sizes s ON pv.size_id = s.id
          LEFT JOIN inventory i ON i.variant_id = pv.id
          WHERE pv.product_id = v_product_id
            AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
        ),
        grouped_alternatives AS (
          SELECT 
            color_name,
            string_agg(size_name, '، ' ORDER BY 
              CASE size_name 
                WHEN 'S' THEN 1 
                WHEN 'M' THEN 2 
                WHEN 'L' THEN 3 
                WHEN 'XL' THEN 4 
                WHEN 'XXL' THEN 5 
                ELSE 6 
              END
            ) as sizes_list
          FROM available_variants
          WHERE color_name != '' AND size_name != ''
          GROUP BY color_name
          UNION ALL
          SELECT 
            color_name,
            'متوفر' as sizes_list
          FROM available_variants
          WHERE color_name != '' AND size_name = ''
          GROUP BY color_name
        )
        SELECT string_agg(
          CASE 
            WHEN color_name != '' THEN color_name || ' (' || sizes_list || ')'
            ELSE sizes_list
          END, 
          '، ' 
          ORDER BY color_name
        ) INTO v_alternatives_text
        FROM grouped_alternatives;
        
        -- إضافة البدائل إلى رسالة الخطأ
        IF v_alternatives_text IS NOT NULL AND v_alternatives_text != '' THEN
          v_error_message := v_error_message || E'\n\nالمتوفر فعلياً: ' || v_alternatives_text;
        ELSE
          v_error_message := v_error_message || E'\n\nهذا المنتج غير متوفر حالياً بأي مواصفات.';
        END IF;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'out_of_stock',
          'message', v_error_message
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