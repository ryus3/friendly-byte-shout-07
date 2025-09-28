-- استعادة دالة extract_product_items_from_text لتعمل بشكل صحيح
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
  
  -- إذا وجدنا منتج، ابحث عن المتغير المطابق
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
    
    -- البحث عن متغير المنتج المطابق
    SELECT pv.id INTO v_variant_id
    FROM product_variants pv
    WHERE pv.product_id = v_found_product_id
      AND (v_color_id IS NULL OR pv.color_id = v_color_id)
      AND (v_size_id IS NULL OR pv.size_id = v_size_id)
    ORDER BY 
      CASE 
        WHEN pv.color_id = v_color_id AND pv.size_id = v_size_id THEN 1
        WHEN pv.color_id = v_color_id THEN 2
        WHEN pv.size_id = v_size_id THEN 3
        ELSE 4
      END
    LIMIT 1;
    
    -- التحقق من المخزون
    v_stock_check := 0;
    IF v_variant_id IS NOT NULL THEN
      SELECT COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) 
      INTO v_stock_check
      FROM inventory i 
      WHERE i.variant_id = v_variant_id;
    END IF;
    
    -- بناء العنصر النهائي
    v_result := jsonb_build_array(
      jsonb_build_object(
        'quantity', 1,
        'product_id', v_found_product_id,
        'product_name', v_found_product_name,
        'color_name', COALESCE(v_requested_color, 'غير محدد'),
        'size_name', COALESCE(v_requested_size, 'غير محدد'),
        'unit_price', v_found_product_price,
        'total_price', v_found_product_price,
        'variant_id', v_variant_id,
        'available_stock', COALESCE(v_stock_check, 0)
      )
    );
    
    RAISE NOTICE '✅ تم العثور على منتج: % (اللون: %, الحجم: %)', v_found_product_name, v_requested_color, v_requested_size;
  ELSE
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
  END IF;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;