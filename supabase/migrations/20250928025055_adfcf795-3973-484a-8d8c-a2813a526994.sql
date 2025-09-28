-- إصلاح سريع للبوت: إعادة استخدام الدالة القديمة المُختبرة
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
    SELECT p.id, p.name, p.base_price, p.cost_price
    FROM products p
    WHERE p.name IS NOT NULL 
    ORDER BY length(p.name) DESC
  LOOP
    IF position(lower(v_product.name) in lower(v_normalized_text)) > 0 THEN
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'price', COALESCE(v_product.base_price, 0),
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
      'message', '❌ لم يتم العثور على أي منتجات مطابقة في طلبك.'
    );
  END IF;
  
  -- البحث عن الألوان والأحجام في النص
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث عن الألوان
    IF v_word = ANY(v_color_aliases) THEN
      v_requested_color := v_word;
      v_normalized_color := v_color_mapping->>v_word;
    END IF;
    
    -- البحث عن الأحجام
    IF v_word = ANY(v_size_aliases) THEN
      v_requested_size := v_word;
      v_normalized_size := v_size_mapping->>v_word;
    END IF;
  END LOOP;
  
  -- معالجة كل منتج موجود
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_current_item->>'id')::uuid;
      v_product_name text := v_current_item->>'name';
      v_base_price numeric := (v_current_item->>'price')::numeric;
      v_color_id uuid;
      v_size_id uuid;
      v_available_quantity integer := 0;
    BEGIN
      -- البحث عن اللون المطابق
      IF v_normalized_color IS NOT NULL THEN
        SELECT id INTO v_color_id FROM colors WHERE lower(name) = lower(v_normalized_color) LIMIT 1;
      END IF;
      
      -- البحث عن الحجم المطابق
      IF v_normalized_size IS NOT NULL THEN
        SELECT id INTO v_size_id FROM sizes WHERE lower(name) = lower(v_normalized_size) LIMIT 1;
      END IF;
      
      -- البحث عن variant متوفر
      SELECT pv.id, pv.price, COALESCE(i.quantity - i.reserved_quantity, 0)
      INTO v_variant.id, v_variant.price, v_available_quantity
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
        AND pv.is_active = true
        AND COALESCE(i.quantity - i.reserved_quantity, 0) > 0
      ORDER BY 
        CASE WHEN v_color_id IS NOT NULL AND pv.color_id = v_color_id THEN 0 ELSE 1 END,
        CASE WHEN v_size_id IS NOT NULL AND pv.size_id = v_size_id THEN 0 ELSE 1 END,
        COALESCE(i.quantity - i.reserved_quantity, 0) DESC
      LIMIT 1;
      
      -- إذا وُجد variant متوفر
      IF v_variant.id IS NOT NULL AND v_available_quantity > 0 THEN
        v_current_item := jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_product_name,
          'variant_id', v_variant.id,
          'color', v_normalized_color,
          'size', v_normalized_size,
          'quantity', v_quantity,
          'unit_price', COALESCE(v_variant.price, v_base_price),
          'total_price', COALESCE(v_variant.price, v_base_price) * v_quantity,
          'available_quantity', v_available_quantity
        );
        
        v_final_items := v_final_items || jsonb_build_array(v_current_item);
        RAISE NOTICE '✅ المنتج متوفر: % - %', v_product_name, v_available_quantity;
      ELSE
        -- البحث عن بدائل متوفرة
        SELECT json_agg(
          json_build_object(
            'color', c.name,
            'size', s.name,
            'quantity', COALESCE(i.quantity - i.reserved_quantity, 0)
          )
        ) INTO v_product_alternatives
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product_id
          AND pv.is_active = true
          AND COALESCE(i.quantity - i.reserved_quantity, 0) > 0
        LIMIT 5;
        
        v_available_alternatives := v_available_alternatives || 
          '🔸 ' || v_product_name || 
          CASE 
            WHEN v_requested_color IS NOT NULL OR v_requested_size IS NOT NULL THEN
              ' (المطلوب: ' || 
              COALESCE(v_requested_color, '') || 
              CASE WHEN v_requested_color IS NOT NULL AND v_requested_size IS NOT NULL THEN ' ' ELSE '' END ||
              COALESCE(v_requested_size, '') || 
              ' - غير متوفر)' || E'\n'
            ELSE ' - غير متوفر' || E'\n'
          END;
        
        RAISE NOTICE '❌ المنتج غير متوفر: %', v_product_name;
      END IF;
    END;
  END LOOP;
  
  -- إذا لم توجد عناصر متوفرة
  IF jsonb_array_length(v_final_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'availability_check_failed',
      'message', '⚠️ المنتجات المطلوبة غير متوفرة حالياً.' || 
        CASE WHEN v_available_alternatives != '' THEN E'\n\n' || v_available_alternatives ELSE '' END
    );
  END IF;
  
  -- النجاح: المنتجات متوفرة
  RETURN jsonb_build_object(
    'success', true,
    'items', v_final_items,
    'message', '✅ جميع المنتجات متوفرة!'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في فحص التوفر: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '⚠️ حدث خطأ أثناء فحص توفر المنتجات. يرجى إعادة المحاولة.',
      'details', SQLERRM
    );
END;
$function$;