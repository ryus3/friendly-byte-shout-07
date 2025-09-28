-- إنشاء دالة فحص التوفر الصارم مع استخراج الكمية المحسن
CREATE OR REPLACE FUNCTION extract_product_items_with_availability_check(input_text text)
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
  RAISE NOTICE '🔄 بدء استخراج المنتجات مع فحص التوفر الصارم من النص: %', input_text;
  
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
  
  -- إذا لم نجد منتجات، أرجع خطأ
  IF jsonb_array_length(v_found_products) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_products_found',
      'message', '❌ لم يتم العثور على أي منتج في طلبك. يرجى التأكد من اسم المنتج.'
    );
  END IF;
  
  -- معالجة كل منتج مع فحص التوفر الصارم
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_current_item->>'id')::uuid;
      v_product_name text := v_current_item->>'name';
      v_found_color_id uuid := NULL;
      v_found_color_name text := NULL;
      v_found_size_id uuid := NULL;
      v_found_size_name text := NULL;
    BEGIN
      
      -- استخراج اللون والحجم الأول إن وجد
      IF jsonb_array_length(v_found_colors) > 0 THEN
        v_found_color_id := ((v_found_colors->0)->>'id')::uuid;
        v_found_color_name := (v_found_colors->0)->>'name';
      END IF;
      
      IF jsonb_array_length(v_found_sizes) > 0 THEN
        v_found_size_id := ((v_found_sizes->0)->>'id')::uuid;
        v_found_size_name := (v_found_sizes->0)->>'name';
      END IF;
      
      -- فحص التوفر الصارم
      SELECT id, price, COALESCE(i.quantity - COALESCE(i.reserved_quantity, 0), 0)
      INTO v_variant_id, v_variant_price, v_variant_qty
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product_id
        AND (v_found_color_id IS NULL OR pv.color_id = v_found_color_id)
        AND (v_found_size_id IS NULL OR pv.size_id = v_found_size_id)
        AND pv.is_active = true
        AND COALESCE(i.quantity - COALESCE(i.reserved_quantity, 0), 0) >= v_quantity
      LIMIT 1;
      
      -- إذا لم نجد variant متوفر بالمواصفات المطلوبة
      IF v_variant_id IS NULL THEN
        -- جمع البدائل المتوفرة
        SELECT string_agg(DISTINCT c.name, '، ') INTO v_available_colors
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product_id 
          AND pv.is_active = true
          AND COALESCE(i.quantity - COALESCE(i.reserved_quantity, 0), 0) >= v_quantity;
        
        SELECT string_agg(DISTINCT s.name, '، ') INTO v_available_sizes
        FROM product_variants pv
        JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product_id 
          AND pv.is_active = true
          AND COALESCE(i.quantity - COALESCE(i.reserved_quantity, 0), 0) >= v_quantity;
        
        -- إنشاء رسالة خطأ مفصلة
        v_error_message := '❌ فشل في إنشاء الطلب: المنتج "' || v_product_name || '"';
        
        IF v_found_color_name IS NOT NULL THEN
          v_error_message := v_error_message || ' غير متوفر باللون "' || v_found_color_name || '"';
        END IF;
        
        IF v_found_size_name IS NOT NULL THEN
          v_error_message := v_error_message || ' والحجم "' || v_found_size_name || '"';
        END IF;
        
        v_error_message := v_error_message || '.' || CHR(10) || CHR(10);
        
        -- إضافة البدائل المتوفرة
        IF v_available_colors IS NOT NULL AND v_available_colors != '' THEN
          v_error_message := v_error_message || '🎨 الألوان المتوفرة: ' || v_available_colors || CHR(10);
        END IF;
        
        IF v_available_sizes IS NOT NULL AND v_available_sizes != '' THEN
          v_error_message := v_error_message || '📏 الأحجام المتوفرة: ' || v_available_sizes;
        END IF;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', 'product_not_available',
          'message', v_error_message
        );
      END IF;
      
      -- إنشاء عنصر الطلب مع المعلومات الكاملة
      v_current_item := jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'variant_id', v_variant_id,
        'color_id', v_found_color_id,
        'color', v_found_color_name,
        'size_id', v_found_size_id,
        'size', v_found_size_name,
        'quantity', v_quantity,
        'unit_price', COALESCE(v_variant_price, v_current_item->>'base_price'::numeric, 0),
        'total_price', (COALESCE(v_variant_price, (v_current_item->>'base_price')::numeric, 0) * v_quantity) + v_delivery_fee,
        'delivery_fee', v_delivery_fee,
        'available_qty', v_variant_qty
      );
      
      v_final_items := v_final_items || jsonb_build_array(v_current_item);
      
      RAISE NOTICE '✅ تم إنشاء عنصر منتج: %', v_current_item;
    END;
  END LOOP;
  
  RAISE NOTICE '🎯 انتهاء استخراج المنتجات: % عنصر', jsonb_array_length(v_final_items);
  
  -- إرجاع النتيجة النهائية
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
      'message', '⚠️ حدث خطأ في معالجة المنتجات. يرجى إعادة المحاولة.'
    );
END;
$function$;