-- إزالة الدالة الحالية المعطوبة وإعادة إنشائها بشكل صحيح
DROP FUNCTION IF EXISTS public.extract_product_items_with_availability_check(text);

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
  v_quantity integer := 1;
  v_current_item jsonb;
  v_found_products jsonb := '[]';
  v_found_colors jsonb := '[]';
  v_found_sizes jsonb := '[]';
  v_variant record;
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
  v_color_aliases text[] := ARRAY[
    'احمر', 'أحمر', 'red', 'ريد',
    'ازرق', 'أزرق', 'سمائي', 'blue', 'sky', 'بلو',
    'اسود', 'أسود', 'black', 'بلاك',
    'ابيض', 'أبيض', 'white', 'وايت',
    'اخضر', 'أخضر', 'green', 'جرين',
    'اصفر', 'أصفر', 'yellow', 'يلو',
    'بنفسجي', 'purple', 'بربل',
    'وردي', 'pink', 'بنك',
    'رمادي', 'gray', 'grey', 'جراي',
    'بني', 'brown', 'براون'
  ];
  v_color_mapping jsonb := jsonb_build_object(
    'احمر', 'احمر', 'أحمر', 'احمر', 'red', 'احمر', 'ريد', 'احمر',
    'ازرق', 'سمائي', 'أزرق', 'سمائي', 'سمائي', 'سمائي', 'blue', 'سمائي', 'sky', 'سمائي', 'بلو', 'سمائي',
    'اسود', 'اسود', 'أسود', 'اسود', 'black', 'اسود', 'بلاك', 'اسود',
    'ابيض', 'ابيض', 'أبيض', 'ابيض', 'white', 'ابيض', 'وايت', 'ابيض',
    'اخضر', 'اخضر', 'أخضر', 'اخضر', 'green', 'اخضر', 'جرين', 'اخضر',
    'اصفر', 'اصفر', 'أصفر', 'اصفر', 'yellow', 'اصفر', 'يلو', 'اصفر',
    'بنفسجي', 'بنفسجي', 'purple', 'بنفسجي', 'بربل', 'بنفسجي',
    'وردي', 'وردي', 'pink', 'وردي', 'بنك', 'وردي',
    'رمادي', 'رمادي', 'gray', 'رمادي', 'grey', 'رمادي', 'جراي', 'رمادي',
    'بني', 'بني', 'brown', 'بني', 'براون', 'بني'
  );
  v_requested_color text;
  v_requested_size text;
  v_normalized_color text;
  v_normalized_size text;
  v_available_alternatives text := '';
  v_product_alternatives jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔍 بدء فحص التوفر للنص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المنتجات في النص
  FOR v_product IN 
    SELECT p.id, p.name, p.price, p.cost_price
    FROM products p
    WHERE p.name IS NOT NULL 
    ORDER BY length(p.name) DESC
  LOOP
    IF position(lower(v_product.name) in lower(v_normalized_text)) > 0 THEN
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'price', COALESCE(v_product.price, 0),
        'cost_price', COALESCE(v_product.cost_price, 0)
      );
      v_found_products := v_found_products || v_temp_product;
    END IF;
  END LOOP;
  
  -- إذا لم يتم العثور على منتجات
  IF jsonb_array_length(v_found_products) = 0 THEN
    RAISE NOTICE '❌ لم يتم العثور على منتجات في النص';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_products_found',
      'message', '⚠️ لم يتم التعرف على أي منتج في طلبك. يرجى كتابة اسم المنتج بوضوح.'
    );
  END IF;
  
  -- البحث عن الألوان المطلوبة في النص
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word = ANY(v_color_aliases) THEN
      v_requested_color := v_word;
      v_normalized_color := v_color_mapping->>v_word;
      EXIT;
    END IF;
  END LOOP;
  
  -- البحث عن الأحجام المطلوبة في النص
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word = ANY(v_size_aliases) THEN
      v_requested_size := v_word;
      v_normalized_size := v_size_mapping->>v_word;
      EXIT;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🎨 لون مطلوب: % -> %', v_requested_color, v_normalized_color;
  RAISE NOTICE '📏 حجم مطلوب: % -> %', v_requested_size, v_normalized_size;
  
  -- معالجة كل منتج تم العثور عليه
  FOR v_temp_product IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_temp_product->>'id')::uuid;
      v_product_name text := v_temp_product->>'name';
      v_variant_found boolean := false;
      v_error_message text := '';
    BEGIN
      -- البحث عن البديل المتوفر للمنتج
      WITH available_variants AS (
        SELECT 
          pv.id as variant_id,
          pv.color_id,
          pv.size_id,
          c.name as color_name,
          s.name as size_name,
          COALESCE(pv.price, (v_temp_product->>'price')::numeric, 0) as variant_price,
          COALESCE(i.quantity, 0) as available_quantity
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product_id
          AND COALESCE(i.quantity, 0) > 0
      ),
      alternatives_summary AS (
        SELECT 
          string_agg(
            DISTINCT CASE 
              WHEN av.color_name IS NOT NULL AND av.size_name IS NOT NULL 
              THEN av.color_name || ' (' || string_agg(DISTINCT av.size_name, '، ') || ')'
              WHEN av.color_name IS NOT NULL 
              THEN av.color_name
              WHEN av.size_name IS NOT NULL 
              THEN 'الحجم: ' || av.size_name
              ELSE 'متوفر'
            END, 
            '، '
          ) as alternatives_text
        FROM available_variants av
        GROUP BY av.color_name
      )
      SELECT alternatives_text INTO v_available_alternatives 
      FROM alternatives_summary;
      
      -- التحقق من توفر التركيبة المطلوبة تماماً
      SELECT 
        pv.id, 
        COALESCE(pv.price, (v_temp_product->>'price')::numeric, 0),
        COALESCE(i.quantity, 0)
      INTO v_variant
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product_id
        AND (v_normalized_color IS NULL OR lower(c.name) = lower(v_normalized_color))
        AND (v_normalized_size IS NULL OR lower(s.name) = lower(v_normalized_size))
        AND COALESCE(i.quantity, 0) > 0
      LIMIT 1;
      
      -- إذا لم يتم العثور على التركيبة المطلوبة
      IF v_variant.id IS NULL THEN
        -- تحديد سبب عدم التوفر
        IF v_normalized_color IS NOT NULL THEN
          -- التحقق من توفر اللون للمنتج
          IF NOT EXISTS (
            SELECT 1 FROM product_variants pv
            LEFT JOIN colors c ON pv.color_id = c.id
            LEFT JOIN inventory i ON pv.id = i.variant_id
            WHERE pv.product_id = v_product_id
              AND lower(c.name) = lower(v_normalized_color)
              AND COALESCE(i.quantity, 0) > 0
          ) THEN
            v_error_message := '❌ اللون "' || v_normalized_color || '" غير متوفر للمنتج "' || v_product_name || '"';
          ELSIF v_normalized_size IS NOT NULL THEN
            v_error_message := '❌ الحجم "' || v_normalized_size || '" غير متوفر باللون "' || v_normalized_color || '" للمنتج "' || v_product_name || '"';
          END IF;
        ELSIF v_normalized_size IS NOT NULL THEN
          v_error_message := '❌ الحجم "' || v_normalized_size || '" غير متوفر للمنتج "' || v_product_name || '"';
        ELSE
          v_error_message := '❌ المنتج "' || v_product_name || '" غير متوفر حالياً';
        END IF;
        
        -- إضافة البدائل المتوفرة
        IF v_available_alternatives IS NOT NULL AND v_available_alternatives != '' THEN
          v_error_message := v_error_message || E'\n\n✅ البدائل المتوفرة:\n' || v_available_alternatives;
        ELSE
          v_error_message := v_error_message || E'\n\n😔 لا توجد بدائل متوفرة حالياً لهذا المنتج.';
        END IF;
        
        RAISE NOTICE '❌ فشل فحص التوفر: %', v_error_message;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'variant_not_available',
          'message', v_error_message,
          'product_name', v_product_name,
          'requested_color', v_normalized_color,
          'requested_size', v_normalized_size,
          'available_alternatives', v_available_alternatives
        );
      END IF;
      
      -- إنشاء عنصر الطلب للتركيبة المتوفرة
      v_current_item := jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'variant_id', v_variant.id,
        'color', v_normalized_color,
        'size', v_normalized_size,
        'quantity', v_quantity,
        'unit_price', v_variant.price,
        'total_price', v_variant.price * v_quantity,
        'available_quantity', v_variant.quantity
      );
      
      v_final_items := v_final_items || v_current_item;
      v_variant_found := true;
      
      RAISE NOTICE '✅ تم العثور على التركيبة المطلوبة: % %', v_normalized_color, v_normalized_size;
    END;
  END LOOP;
  
  -- إرجاع النتيجة النهائية
  RETURN jsonb_build_object(
    'success', true,
    'items', v_final_items
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في فحص التوفر: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '⚠️ حدث خطأ أثناء فحص توفر المنتجات. يرجى إعادة المحاولة.',
      'details', SQLERRM
    );
END;
$function$;