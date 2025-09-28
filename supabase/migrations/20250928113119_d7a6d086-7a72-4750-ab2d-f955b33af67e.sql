-- تحسين دالة استخراج المنتجات لتستخدم الدالة الجديدة وتعطي معلومات أدق
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
  v_availability_info jsonb;
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
  
  -- إذا وجدنا منتج، احصل على معلومات التوفر
  IF v_found_product_id IS NOT NULL THEN
    SELECT get_product_available_variants(v_found_product_id, v_requested_color, v_requested_size) 
    INTO v_availability_info;
    
    -- بناء العنصر النهائي
    v_result := jsonb_build_array(
      jsonb_build_object(
        'quantity', 1,
        'product_id', v_found_product_id,
        'product_name', v_found_product_name,
        'color_name', COALESCE(v_requested_color, 'يرجى تحديد اللون'),
        'size_name', COALESCE(v_requested_size, 'يرجى تحديد الحجم'),
        'unit_price', v_found_product_price,
        'total_price', v_found_product_price,
        'variant_id', NULL,
        'stock_status', v_availability_info->>'stock_status',
        'available_colors', v_availability_info->'available_colors',
        'colors_with_sizes', v_availability_info->'colors_with_sizes',
        'alternatives_message', v_availability_info->>'alternatives_message',
        'selection_needed', v_availability_info->'selection_needed',
        'is_available', v_availability_info->'is_available'
      )
    );
    
    RAISE NOTICE '✅ تم استخراج المنتج: % - اللون: % - الحجم: %', v_found_product_name, COALESCE(v_requested_color, 'غير محدد'), COALESCE(v_requested_size, 'غير محدد');
  ELSE
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
  END IF;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$$;