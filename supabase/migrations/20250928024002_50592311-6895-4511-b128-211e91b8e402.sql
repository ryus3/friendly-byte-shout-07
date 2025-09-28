-- إصلاح شامل لدالة extract_product_items_with_availability_check لفحص توفر الألوان والأحجام الفعلية
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
  v_quantity integer := 1;
  v_found_products jsonb := '[]';
  v_found_colors text[] := '{}';
  v_found_sizes text[] := '{}';
  v_variant_id uuid;
  v_variant_price numeric;
  v_variant_qty integer;
  v_price numeric := 0;
  v_normalized_text text;
  v_temp_product jsonb;
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
  v_alternatives_text text := '';
  v_current_item jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات مع فحص التوفر من النص: %', input_text;
  
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_normalized_text := lower(trim(v_normalized_text));
  
  -- استخراج الكمية
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
  
  -- تحقق من وجود منتج
  IF jsonb_array_length(v_found_products) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_product_found',
      'message', '⚠️ لم يتم العثور على أي منتج. يرجى التأكد من اسم المنتج.'
    );
  END IF;
  
  -- البحث عن الألوان والأحجام المطلوبة في النص
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- البحث عن الألوان (في جدول الألوان العام فقط لتعريفها)
    IF NOT (v_word = ANY(v_found_colors)) THEN
      IF EXISTS(SELECT 1 FROM colors c WHERE lower(c.name) ILIKE '%' || v_word || '%') THEN
        v_found_colors := v_found_colors || ARRAY[v_word];
        RAISE NOTICE '🎨 تم العثور على لون مطلوب: %', v_word;
      END IF;
    END IF;
    
    -- البحث عن الأحجام (مع معالجة المرادفات)
    IF v_size_mapping ? v_word THEN
      v_word := v_size_mapping->>v_word;
    END IF;
    
    IF NOT (v_word = ANY(v_found_sizes)) THEN
      IF EXISTS(SELECT 1 FROM sizes s WHERE lower(s.name) ILIKE '%' || v_word || '%') THEN
        v_found_sizes := v_found_sizes || ARRAY[v_word];
        RAISE NOTICE '📏 تم العثور على حجم مطلوب: %', v_word;
      END IF;
    END IF;
  END LOOP;
  
  -- معالجة كل منتج مع فحص التوفر الفعلي
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_current_item->>'id')::uuid;
      v_product_name text := v_current_item->>'name';
      v_base_price numeric := (v_current_item->>'base_price')::numeric;
      v_requested_color text := NULL;
      v_requested_size text := NULL;
      v_available_color_id uuid := NULL;
      v_available_size_id uuid := NULL;
    BEGIN
      -- تحديد اللون والحجم المطلوب
      IF array_length(v_found_colors, 1) > 0 THEN
        v_requested_color := v_found_colors[1];
      END IF;
      
      IF array_length(v_found_sizes, 1) > 0 THEN
        v_requested_size := v_found_sizes[1];
      END IF;
      
      -- فحص توفر اللون المطلوب للمنتج المحدد
      IF v_requested_color IS NOT NULL THEN
        SELECT DISTINCT c.id, c.name INTO v_available_color_id, v_target_color_name
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        JOIN inventory i ON i.variant_id = pv.id
        WHERE pv.product_id = v_product_id
          AND lower(c.name) ILIKE '%' || v_requested_color || '%'
          AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
        LIMIT 1;
        
        IF v_available_color_id IS NULL THEN
          -- اللون المطلوب غير متوفر - بناء رسالة خطأ مع البدائل
          v_error_message := '❌ فشل في إنشاء الطلب: المنتج "' || v_product_name || '" غير متوفر باللون "' || v_requested_color || '".';
          
          -- جمع البدائل المتوفرة
          WITH available_variants AS (
            SELECT 
              COALESCE(c.name, '') as color_name,
              COALESCE(s.name, '') as size_name
            FROM product_variants pv
            LEFT JOIN colors c ON pv.color_id = c.id
            LEFT JOIN sizes s ON pv.size_id = s.id
            LEFT JOIN inventory i ON i.variant_id = pv.id
            WHERE pv.product_id = v_product_id
              AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
              AND c.name IS NOT NULL
          ),
          grouped_alternatives AS (
            SELECT 
              color_name,
              string_agg(
                CASE WHEN size_name != '' THEN size_name ELSE NULL END, 
                '، ' 
                ORDER BY 
                  CASE size_name 
                    WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 
                    WHEN 'XL' THEN 4 WHEN 'XXL' THEN 5 ELSE 6 
                  END
              ) as sizes_list
            FROM available_variants
            WHERE color_name != ''
            GROUP BY color_name
          )
          SELECT string_agg(
            color_name || 
            CASE 
              WHEN sizes_list IS NOT NULL THEN ' (' || sizes_list || ')'
              ELSE ''
            END, 
            '، ' 
            ORDER BY color_name
          ) INTO v_alternatives_text
          FROM grouped_alternatives;
          
          IF v_alternatives_text IS NOT NULL AND v_alternatives_text != '' THEN
            v_error_message := v_error_message || E'\n\nالمتوفر فعلياً: ' || v_alternatives_text;
          ELSE
            v_error_message := v_error_message || E'\n\nهذا المنتج غير متوفر حالياً بأي لون.';
          END IF;
          
          RETURN jsonb_build_object(
            'success', false,
            'error', 'color_not_available',
            'message', v_error_message
          );
        END IF;
      END IF;
      
      -- فحص توفر الحجم المطلوب
      IF v_requested_size IS NOT NULL THEN
        SELECT DISTINCT s.id, s.name INTO v_available_size_id, v_target_size_name
        FROM product_variants pv
        JOIN sizes s ON pv.size_id = s.id
        JOIN inventory i ON i.variant_id = pv.id
        WHERE pv.product_id = v_product_id
          AND (v_available_color_id IS NULL OR pv.color_id = v_available_color_id)
          AND lower(s.name) ILIKE '%' || v_requested_size || '%'
          AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
        LIMIT 1;
        
        IF v_available_size_id IS NULL THEN
          -- الحجم المطلوب غير متوفر
          v_error_message := '❌ فشل في إنشاء الطلب: المنتج "' || v_product_name || '"';
          
          IF v_target_color_name IS NOT NULL THEN
            v_error_message := v_error_message || ' باللون "' || v_target_color_name || '"';
          END IF;
          
          v_error_message := v_error_message || ' غير متوفر بالحجم "' || v_requested_size || '".';
          
          -- جمع الأحجام المتوفرة
          WITH available_sizes AS (
            SELECT DISTINCT s.name as size_name
            FROM product_variants pv
            JOIN sizes s ON pv.size_id = s.id
            JOIN inventory i ON i.variant_id = pv.id
            WHERE pv.product_id = v_product_id
              AND (v_available_color_id IS NULL OR pv.color_id = v_available_color_id)
              AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
          )
          SELECT string_agg(size_name, '، ' ORDER BY 
            CASE size_name 
              WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 
              WHEN 'XL' THEN 4 WHEN 'XXL' THEN 5 ELSE 6 
            END
          ) INTO v_alternatives_text
          FROM available_sizes;
          
          IF v_alternatives_text IS NOT NULL AND v_alternatives_text != '' THEN
            v_error_message := v_error_message || E'\n\nالأحجام المتوفرة: ' || v_alternatives_text;
          ELSE
            v_error_message := v_error_message || E'\n\nلا توجد أحجام متوفرة حالياً.';
          END IF;
          
          RETURN jsonb_build_object(
            'success', false,
            'error', 'size_not_available',
            'message', v_error_message
          );
        END IF;
      END IF;
      
      -- البحث عن المتغير المطابق والتحقق من الكمية
      SELECT pv.id, pv.price, 
             COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_qty
      INTO v_variant_id, v_variant_price, v_variant_qty
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = v_product_id
        AND (v_available_color_id IS NULL OR pv.color_id = v_available_color_id)
        AND (v_available_size_id IS NULL OR pv.size_id = v_available_size_id)
      ORDER BY (pv.color_id IS NOT NULL)::int DESC, (pv.size_id IS NOT NULL)::int DESC
      LIMIT 1;
      
      -- فحص توفر الكمية
      IF v_variant_id IS NULL OR COALESCE(v_variant_qty, 0) < v_quantity THEN
        v_error_message := '❌ فشل في إنشاء الطلب: المنتج "' || v_product_name || '" غير متوفر بالكمية المطلوبة (' || v_quantity || ').';
        
        IF v_variant_qty > 0 THEN
          v_error_message := v_error_message || E'\nالكمية المتوفرة: ' || v_variant_qty;
        ELSE
          v_error_message := v_error_message || E'\nالمنتج غير متوفر حالياً.';
        END IF;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'insufficient_quantity',
          'message', v_error_message
        );
      END IF;
      
      -- إضافة العنصر للنتيجة
      v_price := COALESCE(v_variant_price, v_base_price);
      
      v_final_items := v_final_items || jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'variant_id', v_variant_id,
        'color', v_target_color_name,
        'size', v_target_size_name,
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