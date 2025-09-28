-- Fix the extract_product_items_with_availability_check function with correct PostgreSQL syntax
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
      v_available_qty integer := 0;
    BEGIN
      -- استخراج اللون والحجم المطلوبين
      IF jsonb_array_length(v_found_colors) > 0 THEN
        v_color_id := (v_found_colors->0->>'id')::uuid;
        v_color_name := v_found_colors->0->>'name';
      END IF;
      
      IF jsonb_array_length(v_found_sizes) > 0 THEN
        v_size_id := (v_found_sizes->0->>'id')::uuid;
        v_size_name := v_found_sizes->0->>'name';
      END IF;
      
      -- البحث عن المتغير المطلوب مع فحص التوفر
      SELECT pv.id, pv.price, COALESCE(i.quantity, 0)
      INTO v_variant_id, v_variant_price, v_available_qty
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
        AND pv.is_active = true
        AND COALESCE(i.quantity, 0) > 0
      LIMIT 1;
      
      IF v_variant_id IS NOT NULL AND v_available_qty > 0 THEN
        -- المنتج متوفر
        v_unit_price := COALESCE(v_variant_price, (v_current_item->>'base_price')::numeric, 0);
        v_total_price := v_unit_price + v_delivery_fee;
        
        v_final_items := v_final_items || jsonb_build_array(jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_product_name,
          'color_id', v_color_id,
          'color', v_color_name,
          'size_id', v_size_id,
          'size', v_size_name,
          'quantity', v_quantity,
          'unit_price', v_unit_price,
          'delivery_fee', v_delivery_fee,
          'total_price', v_total_price,
          'available_qty', v_available_qty
        ));
        
        v_variant_found := true;
      ELSE
        -- المنتج غير متوفر، جمع البدائل المتوفرة
        FOR v_variant_id, v_variant_price, v_color_name, v_size_name, v_variant_qty IN 
          SELECT pv.id, pv.price, c.name, s.name, COALESCE(i.quantity, 0)
          FROM product_variants pv
          LEFT JOIN colors c ON c.id = pv.color_id
          LEFT JOIN sizes s ON s.id = pv.size_id
          LEFT JOIN inventory i ON i.variant_id = pv.id
          WHERE pv.product_id = v_product_id
            AND pv.is_active = true
            AND COALESCE(i.quantity, 0) > 0
          ORDER BY i.quantity DESC
          LIMIT 10
        LOOP
          v_available_variants := v_available_variants || '• ' || v_product_name || 
            CASE WHEN v_color_name IS NOT NULL THEN ' (' || v_color_name || ')' ELSE '' END ||
            CASE WHEN v_size_name IS NOT NULL THEN ' ' || v_size_name ELSE '' END ||
            ' - متوفر: ' || v_variant_qty || E'\n';
        END LOOP;
      END IF;
    END;
  END LOOP;
  
  -- التحقق من النتائج النهائية
  IF jsonb_array_length(v_final_items) = 0 THEN
    IF jsonb_array_length(v_found_products) > 0 THEN
      -- منتج موجود لكن غير متوفر
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', '❌ المنتج المطلوب غير متوفر بالمواصفات المحددة. البدائل المتوفرة:' || E'\n\n' || v_available_variants,
        'options_type', 'variant_selection',
        'available_combinations', v_available_variants,
        'target_product', v_target_product_name
      );
    ELSE
      -- لم يتم العثور على أي منتج
      RETURN jsonb_build_object(
        'success', false,
        'error', 'no_products_found',
        'message', '❌ لم أتمكن من التعرف على أي منتج في طلبك. يرجى التأكد من كتابة اسم المنتج بشكل صحيح.'
      );
    END IF;
  END IF;
  
  RAISE NOTICE '✅ تم العثور على % عنصر متوفر', jsonb_array_length(v_final_items);
  
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
      'message', '⚠️ حدث خطأ في تحليل المنتجات. يرجى إعادة المحاولة.'
    );
END;
$function$;