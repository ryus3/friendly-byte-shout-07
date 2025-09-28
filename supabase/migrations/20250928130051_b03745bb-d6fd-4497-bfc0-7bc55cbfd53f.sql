-- إصلاح دالة استخراج المنتجات لتتعرف على النصوص العربية بشكل صحيح
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
  v_available_colors text[] := '{}';
  v_available_sizes text[] := '{}';
  v_item_result jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات باستخدام regexp_split_to_array
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  
  -- استخدام regexp_split_to_array بدلاً من string_to_array لضمان التقسيم الصحيح
  v_words := regexp_split_to_array(lower(trim(v_normalized_text)), E'\\s+');
  
  RAISE NOTICE '📝 الكلمات المستخرجة: %', v_words;
  
  -- البحث عن المنتج
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام والكلمات الفارغة
    IF v_word IS NULL OR length(trim(v_word)) < 2 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    RAISE NOTICE '🔍 البحث عن المنتج بالكلمة: %', v_word;
    
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
      RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_found_product_name, v_found_product_id;
      
      -- استخراج اللون المطلوب
      FOR v_word IN SELECT unnest(v_words)
      LOOP
        FOR i IN 1..array_length(v_color_keywords, 1)
        LOOP
          IF v_word ILIKE '%' || v_color_keywords[i] || '%' THEN
            v_requested_color := v_color_keywords[i];
            RAISE NOTICE '🎨 تم العثور على اللون: %', v_requested_color;
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
      
      IF v_requested_size IS NOT NULL THEN
        RAISE NOTICE '📏 تم العثور على الحجم: %', v_requested_size;
      END IF;
      
      EXIT; -- خروج من حلقة البحث عن المنتجات
    END IF;
  END LOOP;
  
  -- إذا لم نجد منتجاً
  IF v_found_product_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'غير محدد',
        'color', 'غير محدد',
        'size', 'غير محدد',
        'price', 0,
        'quantity', 1,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'لم يتم التعرف على أي منتج في النص المرسل. يرجى التأكد من كتابة اسم المنتج بشكل صحيح.'
      )
    );
  END IF;
  
  -- إذا وجدنا منتج، تحقق من التوفر وجمع البدائل
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
    WHERE lower(name) = lower(v_requested_size)
    LIMIT 1;
  END IF;
  
  -- جمع الألوان والأحجام المتوفرة
  SELECT 
    array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL),
    array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL)
  INTO v_available_colors, v_available_sizes
  FROM product_variants pv
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE pv.product_id = v_found_product_id
    AND pv.is_active = true
    AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0);
  
  -- التحقق من توفر المتغير المحدد
  IF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
    SELECT pv.id INTO v_variant_id
    FROM product_variants pv
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_found_product_id
      AND pv.color_id = v_color_id
      AND pv.size_id = v_size_id
      AND pv.is_active = true
      AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0)
    LIMIT 1;
    
    v_exact_variant_available := (v_variant_id IS NOT NULL);
  END IF;
  
  -- بناء رسالة البدائل إذا لم يكن المتغير متوفراً
  IF NOT v_exact_variant_available THEN
    v_alternatives_message := format('المنتج "%s" ', v_found_product_name);
    
    IF v_requested_color IS NOT NULL AND v_requested_size IS NOT NULL THEN
      v_alternatives_message := v_alternatives_message || format('غير متوفر باللون "%s" والحجم "%s".', 
        COALESCE(v_requested_color, 'غير محدد'), 
        COALESCE(v_requested_size, 'غير محدد'));
    ELSIF v_requested_color IS NOT NULL THEN
      v_alternatives_message := v_alternatives_message || format('غير متوفر باللون "%s".', v_requested_color);
    ELSIF v_requested_size IS NOT NULL THEN
      v_alternatives_message := v_alternatives_message || format('غير متوفر بالحجم "%s".', v_requested_size);
    ELSE
      v_alternatives_message := v_alternatives_message || 'غير متوفر حالياً.';
    END IF;
    
    IF array_length(v_available_colors, 1) > 0 THEN
      v_alternatives_message := v_alternatives_message || E'\n\nالمتوفر فعلياً: ' || array_to_string(v_available_colors, ', ');
    END IF;
    
    IF array_length(v_available_sizes, 1) > 0 THEN
      v_alternatives_message := v_alternatives_message || E'\n' || array_to_string(v_available_sizes, ', ');
    END IF;
  END IF;
  
  -- بناء النتيجة النهائية
  v_item_result := jsonb_build_object(
    'product_id', v_found_product_id,
    'product_name', v_found_product_name,
    'color', COALESCE(v_requested_color, 'يرجى تحديد اللون'),
    'size', COALESCE(v_requested_size, 'يرجى تحديد الحجم'),
    'price', COALESCE(v_found_product_price, 0),
    'quantity', 1,
    'total_price', COALESCE(v_found_product_price, 0),
    'variant_id', v_variant_id,
    'is_available', v_exact_variant_available,
    'alternatives_message', CASE 
      WHEN v_exact_variant_available THEN NULL 
      ELSE v_alternatives_message 
    END
  );
  
  v_result := jsonb_build_array(v_item_result);
  
  RAISE NOTICE '📦 نتيجة استخراج المنتجات: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ في المعالجة',
        'color', 'غير محدد',
        'size', 'غير محدد',
        'price', 0,
        'quantity', 1,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة.'
      )
    );
END;
$function$;