-- تحديث دالة استخراج المنتجات لتشمل فحص التوفر وإظهار البدائل
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
  v_color_keywords text[] := ARRAY['احمر', 'أحمر', 'ازرق', 'أزرق', 'اسود', 'أسود', 'ابيض', 'أبيض', 'اصفر', 'أصفر', 'اخضر', 'أخضر', 'بنفسجي', 'وردي', 'رمادي', 'بني', 'برتقالي', 'سمائي'];
  v_size_keywords text[] := ARRAY['سمول', 'صغير', 'ميديم', 'متوسط', 'وسط', 'لارج', 'كبير', 'اكس', 'xl', 'xxl', 's', 'm', 'l'];
  v_found_product_id uuid;
  v_found_product_name text;
  v_found_product_price numeric;
  v_requested_color text := NULL;
  v_requested_size text := NULL;
  v_normalized_text text;
  v_variant_id uuid;
  v_color_id uuid;
  v_size_id uuid;
  v_stock_check integer;
  v_exact_variant_available boolean := false;
  v_alternatives_data jsonb := '{}';
  v_alternatives_message text := '';
  v_available_colors_sizes jsonb := '{}';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المنتج
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام
    IF length(v_word) < 2 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المنتجات
    SELECT p.id, p.name, p.base_price INTO v_found_product_id, v_found_product_name, v_found_product_price
    FROM products p
    WHERE p.is_active = true
      AND (
        lower(p.name) ILIKE '%' || v_word || '%'
        OR lower(replace(p.name, 'ة', 'ه')) ILIKE '%' || v_word || '%'
        OR lower(replace(p.name, 'ه', 'ة')) ILIKE '%' || v_word || '%'
      )
    ORDER BY 
      CASE 
        WHEN lower(p.name) = v_word THEN 1
        WHEN lower(p.name) LIKE v_word || '%' THEN 2
        ELSE 3
      END,
      length(p.name)
    LIMIT 1;
    
    -- إذا وجدنا منتج، ابحث عن اللون والحجم
    IF v_found_product_id IS NOT NULL THEN
      -- استخراج اللون المطلوب
      FOR v_word IN SELECT unnest(v_words)
      LOOP
        FOR i IN 1..array_length(v_color_keywords, 1)
        LOOP
          IF v_word ILIKE '%' || v_color_keywords[i] || '%' THEN
            v_requested_color := v_color_keywords[i];
            EXIT;
          END IF;
        END LOOP;
        EXIT WHEN v_requested_color IS NOT NULL;
      END LOOP;
      
      -- استخراج الحجم المطلوب
      FOR v_word IN SELECT unnest(v_words)
      LOOP
        -- تحويل مرادفات الأحجام
        IF v_word ILIKE '%سمول%' OR v_word ILIKE '%صغير%' OR v_word = 's' THEN
          v_requested_size := 'S';
          EXIT;
        ELSIF v_word ILIKE '%ميديم%' OR v_word ILIKE '%متوسط%' OR v_word ILIKE '%وسط%' OR v_word = 'm' THEN
          v_requested_size := 'M';
          EXIT;
        ELSIF v_word ILIKE '%لارج%' OR v_word ILIKE '%كبير%' OR v_word = 'l' THEN
          v_requested_size := 'L';
          EXIT;
        ELSIF v_word ILIKE '%xl%' OR v_word ILIKE '%اكس%' THEN
          IF v_word ILIKE '%xx%' OR v_word ILIKE '%اكسين%' THEN
            v_requested_size := 'XXL';
          ELSE
            v_requested_size := 'XL';
          END IF;
          EXIT;
        END IF;
      END LOOP;
      
      EXIT; -- خروج من حلقة البحث عن المنتجات
    END IF;
  END LOOP;
  
  -- إذا وجدنا منتج، تحقق من التوفر وجمع البدائل
  IF v_found_product_id IS NOT NULL THEN
    -- البحث عن IDs للألوان والأحجام إذا كانت محددة
    IF v_requested_color IS NOT NULL THEN
      SELECT id INTO v_color_id 
      FROM colors 
      WHERE lower(name) ILIKE '%' || lower(v_requested_color) || '%' 
      LIMIT 1;
    END IF;
    
    IF v_requested_size IS NOT NULL THEN
      SELECT id INTO v_size_id 
      FROM sizes 
      WHERE upper(name) = upper(v_requested_size) 
      LIMIT 1;
    END IF;
    
    -- التحقق من توفر المتغير المطلوب بدقة
    IF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
      SELECT pv.id, COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0)
      INTO v_variant_id, v_stock_check
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND pv.color_id = v_color_id
        AND pv.size_id = v_size_id
        AND pv.is_active = true;
      
      IF v_variant_id IS NOT NULL AND v_stock_check > 0 THEN
        v_exact_variant_available := true;
      END IF;
    END IF;
    
    -- جمع جميع البدائل المتوفرة للمنتج
    SELECT jsonb_object_agg(
      c.name,
      available_sizes
    ) INTO v_available_colors_sizes
    FROM (
      SELECT 
        c.name,
        jsonb_agg(s.name ORDER BY 
          CASE s.name 
            WHEN 'S' THEN 1 
            WHEN 'M' THEN 2 
            WHEN 'L' THEN 3 
            WHEN 'XL' THEN 4 
            WHEN 'XXL' THEN 5 
            ELSE 6 
          END
        ) as available_sizes
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND pv.is_active = true
        AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
      GROUP BY c.id, c.name
      HAVING COUNT(*) > 0
    ) color_sizes;
    
    -- بناء رسالة البدائل
    IF v_available_colors_sizes IS NOT NULL AND jsonb_typeof(v_available_colors_sizes) = 'object' THEN
      v_alternatives_message := E'✅ المتوفر فعلياً:\n';
      
      FOR v_word IN 
        SELECT key 
        FROM jsonb_each(v_available_colors_sizes) 
        ORDER BY key
      LOOP
        DECLARE
          sizes_array jsonb;
          sizes_text text := '';
        BEGIN
          sizes_array := v_available_colors_sizes->v_word;
          
          -- تحويل مصفوفة الأحجام إلى نص
          SELECT string_agg(value::text, ', ') INTO sizes_text
          FROM jsonb_array_elements_text(sizes_array);
          
          v_alternatives_message := v_alternatives_message || v_word || ' (' || REPLACE(sizes_text, '"', '') || ')' || E'\n';
        END;
      END LOOP;
    END IF;
    
    -- إضافة المنتج إلى النتائج
    IF v_exact_variant_available THEN
      -- المتغير المطلوب متوفر
      v_result := v_result || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_found_product_id,
          'product_name', v_found_product_name,
          'variant_id', v_variant_id,
          'color_name', v_requested_color,
          'size_name', v_requested_size,
          'unit_price', v_found_product_price,
          'quantity', 1,
          'total_price', v_found_product_price,
          'available_stock', v_stock_check,
          'is_available', true,
          'alternatives_message', null,
          'available_colors_sizes', v_available_colors_sizes
        )
      );
    ELSE
      -- المتغير المطلوب غير متوفر، إرجاع معلومات الخطأ والبدائل
      v_result := v_result || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_found_product_id,
          'product_name', v_found_product_name,
          'variant_id', null,
          'color_name', v_requested_color,
          'size_name', v_requested_size,
          'unit_price', v_found_product_price,
          'quantity', 1,
          'total_price', 0,
          'available_stock', 0,
          'is_available', false,
          'alternatives_message', v_alternatives_message,
          'available_colors_sizes', v_available_colors_sizes
        )
      );
    END IF;
    
    RAISE NOTICE '✅ تم معالجة المنتج: % - متوفر: %', v_found_product_name, v_exact_variant_available;
  END IF;
  
  RAISE NOTICE '✅ انتهاء استخراج المنتجات - النتائج: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;