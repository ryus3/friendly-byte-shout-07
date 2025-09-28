-- إصلاح دالة extract_product_items_with_availability_check لحل خطأ "column reference 'id' is ambiguous"
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
  v_available_colors text[] := '{}';
  v_available_sizes text[] := '{}';
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
    -- البحث عن أرقام منفردة قد تكون كمية
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
        'base_price', COALESCE(v_product.base_price, v_product.cost_price, 0)
      );
      
      -- إضافة المنتج إذا لم يكن موجوداً مسبقاً
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_products) AS item 
        WHERE (item->>'id')::uuid = v_product.product_id
      ) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
        RAISE NOTICE '🛍️ تم العثور على منتج: % (ID: %)', v_product.product_name, v_product.product_id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان
  FOREACH v_word IN ARRAY v_words
  LOOP
    FOR v_color IN 
      SELECT c.id as color_id, c.name as color_name, c.hex_code 
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
        'name', v_color.color_name,
        'hex_code', v_color.hex_code
      );
      
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_colors) AS item 
        WHERE (item->>'id')::uuid = v_color.color_id
      ) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
        RAISE NOTICE '🎨 تم العثور على لون: % (ID: %)', v_color.color_name, v_color.color_id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الأحجام مع الدعم للمرادفات
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث المباشر في جدول الأحجام
    FOR v_size IN 
      SELECT s.id as size_id, s.name as size_name 
      FROM sizes s
      WHERE lower(s.name) ILIKE '%' || v_word || '%'
      ORDER BY 
        CASE 
          WHEN lower(s.name) = v_word THEN 1
          WHEN lower(s.name) ILIKE v_word || '%' THEN 2
          ELSE 3
        END
      LIMIT 1
    LOOP
      v_temp_size := jsonb_build_object(
        'id', v_size.size_id,
        'name', v_size.size_name
      );
      
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_sizes) AS item 
        WHERE (item->>'id')::uuid = v_size.size_id
      ) THEN
        v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
        RAISE NOTICE '📏 تم العثور على حجم: % (ID: %)', v_size.size_name, v_size.size_id;
      END IF;
    END LOOP;
    
    -- البحث في المرادفات
    IF v_word = ANY(v_size_aliases) THEN
      DECLARE
        v_mapped_size text := v_size_mapping->>v_word;
      BEGIN
        FOR v_size IN 
          SELECT s.id as size_id, s.name as size_name 
          FROM sizes s
          WHERE s.name = v_mapped_size
          LIMIT 1
        LOOP
          v_temp_size := jsonb_build_object(
            'id', v_size.size_id,
            'name', v_size.size_name
          );
          
          IF NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(v_found_sizes) AS item 
            WHERE (item->>'id')::uuid = v_size.size_id
          ) THEN
            v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
            RAISE NOTICE '📏 تم العثور على حجم من المرادف "%": % (ID: %)', v_word, v_size.size_name, v_size.size_id;
          END IF;
        END LOOP;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE '📊 النتائج النهائية - منتجات: %, ألوان: %, أحجام: %', 
    jsonb_array_length(v_found_products), 
    jsonb_array_length(v_found_colors), 
    jsonb_array_length(v_found_sizes);
  
  -- إذا لم يتم العثور على منتجات، فشل
  IF jsonb_array_length(v_found_products) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_products_found',
      'message', '⚠️ لم يتم العثور على منتجات مطابقة. يرجى التحقق من اسم المنتج وإعادة المحاولة.'
    );
  END IF;
  
  -- معالجة كل منتج
  FOR v_temp_product IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    v_target_product_name := v_temp_product->>'name';
    
    -- الحصول على الألوان والأحجام المتوفرة للمنتج
    SELECT array_agg(DISTINCT c.name) INTO v_available_colors
    FROM product_variants pv
    JOIN colors c ON pv.color_id = c.id
    WHERE pv.product_id = (v_temp_product->>'id')::uuid
    AND pv.is_active = true;
    
    SELECT array_agg(DISTINCT s.name) INTO v_available_sizes
    FROM product_variants pv
    JOIN sizes s ON pv.size_id = s.id
    WHERE pv.product_id = (v_temp_product->>'id')::uuid
    AND pv.is_active = true;
    
    -- البحث عن variant مطابق
    v_variant_id := NULL;
    v_variant_price := 0;
    
    -- إذا تم العثور على لون وحجم
    IF jsonb_array_length(v_found_colors) > 0 AND jsonb_array_length(v_found_sizes) > 0 THEN
      SELECT pv.id, pv.price, COALESCE(inv.quantity, 0)
      INTO v_variant_id, v_variant_price, v_variant_qty
      FROM product_variants pv
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      WHERE pv.product_id = (v_temp_product->>'id')::uuid
      AND pv.color_id = ((v_found_colors->0)->>'id')::uuid
      AND pv.size_id = ((v_found_sizes->0)->>'id')::uuid
      AND pv.is_active = true
      LIMIT 1;
    END IF;
    
    -- فحص توفر الكمية المطلوبة
    IF v_variant_id IS NOT NULL AND COALESCE(v_variant_qty, 0) >= v_quantity THEN
      -- المنتج متوفر
      v_current_item := jsonb_build_object(
        'product_id', (v_temp_product->>'id')::uuid,
        'product_name', v_target_product_name,
        'variant_id', v_variant_id,
        'color', (v_found_colors->0)->>'name',
        'size', (v_found_sizes->0)->>'name',
        'quantity', v_quantity,
        'unit_price', v_variant_price,
        'total_price', v_variant_price * v_quantity,
        'available_quantity', v_variant_qty
      );
      
      v_final_items := v_final_items || jsonb_build_array(v_current_item);
      RAISE NOTICE '✅ تم إضافة منتج متوفر: % × %', v_target_product_name, v_quantity;
      
    ELSE
      -- المنتج غير متوفر أو الكمية غير كافية
      v_available_variants := '';
      
      -- جمع البدائل المتوفرة للمنتج
      FOR v_temp_color IN SELECT * FROM jsonb_array_elements(jsonb_build_array(v_found_colors->0))
      LOOP
        FOR v_temp_size IN SELECT * FROM jsonb_array_elements(jsonb_build_array(v_found_sizes->0))
        LOOP
          SELECT COALESCE(inv.quantity, 0)
          INTO v_variant_qty
          FROM product_variants pv
          LEFT JOIN inventory inv ON inv.variant_id = pv.id
          WHERE pv.product_id = (v_temp_product->>'id')::uuid
          AND pv.color_id = (v_temp_color->>'id')::uuid
          AND pv.size_id = (v_temp_size->>'id')::uuid
          AND pv.is_active = true;
          
          IF COALESCE(v_variant_qty, 0) >= v_quantity THEN
            v_available_variants := v_available_variants || 
              format('• %s %s %s (متوفر: %s)' || E'\n', 
                v_target_product_name,
                v_temp_color->>'name', 
                v_temp_size->>'name',
                v_variant_qty
              );
          END IF;
        END LOOP;
      END LOOP;
      
      -- إذا لم توجد بدائل، ارجع خطأ
      IF v_available_variants = '' THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'out_of_stock',
          'message', format('⚠️ المنتج "%s" غير متوفر حالياً أو الكمية المطلوبة (%s) أكبر من المتوفر.', 
            v_target_product_name, v_quantity)
        );
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error', 'variant_not_available',
          'message', format('⚠️ التركيبة المطلوبة للمنتج "%s" غير متوفرة. البدائل المتوفرة:' || E'\n%s', 
            v_target_product_name, v_available_variants),
          'available_combinations', v_available_variants,
          'options_type', 'variant_selection'
        );
      END IF;
    END IF;
  END LOOP;
  
  -- إرجاع النتيجة النهائية
  RETURN jsonb_build_object(
    'success', true,
    'items', v_final_items,
    'total_quantity', v_quantity,
    'message', 'تم استخراج المنتجات بنجاح'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'extraction_error',
      'message', '⚠️ حدث خطأ في معالجة المنتجات. يرجى إعادة المحاولة.',
      'details', SQLERRM
    );
END;
$function$