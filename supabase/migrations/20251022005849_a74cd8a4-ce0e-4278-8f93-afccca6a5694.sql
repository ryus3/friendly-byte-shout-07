-- استعادة طارئة لدالة extract_product_items_from_text الصحيحة
-- مع تحسين البحث عن المنتجات ذات الكلمتين

-- حذف النسخة الحالية المعطلة
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text, uuid);

-- إعادة إنشاء الدالة الصحيحة (النسخة التي كانت تعمل + تحسينات البحث)
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
  v_found_product_id uuid;
  v_found_product_name text;
  v_found_product_price numeric;
  v_requested_color text := NULL;
  v_requested_size text := NULL;
  v_normalized_text text;
  v_availability_info jsonb;
  
  -- قائمة المنتجات ذات الكلمتين (للبحث الذكي)
  v_two_word_products text[] := ARRAY['سوت شيك', 'توب كات', 'بينك بانثر', 'بلو واتر'];
  v_two_word_product text;
  v_color_keywords text[] := ARRAY['احمر', 'أحمر', 'ازرق', 'أزرق', 'اسود', 'أسود', 'ابيض', 'أبيض', 'اصفر', 'أصفر', 'اخضر', 'أخضر', 'بنفسجي', 'وردي', 'رمادي', 'بني', 'برتقالي', 'سمائي', 'ليموني'];
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- ✅ الخطوة 1: فحص المنتجات ذات الكلمتين أولاً (تحسين جديد)
  FOREACH v_two_word_product IN ARRAY v_two_word_products
  LOOP
    IF lower(v_normalized_text) ILIKE '%' || v_two_word_product || '%' THEN
      -- البحث عن تطابق تام أولاً
      SELECT p.id, p.name, p.base_price 
      INTO v_found_product_id, v_found_product_name, v_found_product_price
      FROM products p
      WHERE p.is_active = true
        AND lower(p.name) = v_two_word_product
      LIMIT 1;
      
      IF v_found_product_id IS NOT NULL THEN
        RAISE NOTICE '✅ وجدنا منتج بكلمتين (تطابق تام): %', v_found_product_name;
        EXIT;
      END IF;
      
      -- إذا لم نجد تطابق تام، نبحث بـ ILIKE
      IF v_found_product_id IS NULL THEN
        SELECT p.id, p.name, p.base_price 
        INTO v_found_product_id, v_found_product_name, v_found_product_price
        FROM products p
        WHERE p.is_active = true
          AND lower(p.name) ILIKE '%' || v_two_word_product || '%'
        ORDER BY length(p.name)
        LIMIT 1;
        
        IF v_found_product_id IS NOT NULL THEN
          RAISE NOTICE '✅ وجدنا منتج بكلمتين (ILIKE): %', v_found_product_name;
          EXIT;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- ✅ الخطوة 2: إذا لم نجد منتج بكلمتين، ابحث عن منتجات عادية
  IF v_found_product_id IS NULL THEN
    FOR v_word IN SELECT unnest(v_words)
    LOOP
      IF length(v_word) < 2 OR v_word ~ '^[0-9]+$' THEN
        CONTINUE;
      END IF;
      
      -- تطابق تام أولاً (أولوية قصوى)
      SELECT p.id, p.name, p.base_price 
      INTO v_found_product_id, v_found_product_name, v_found_product_price
      FROM products p
      WHERE p.is_active = true
        AND lower(p.name) = v_word
      LIMIT 1;
      
      -- ثم ILIKE إذا لم نجد تطابق تام
      IF v_found_product_id IS NULL THEN
        SELECT p.id, p.name, p.base_price 
        INTO v_found_product_id, v_found_product_name, v_found_product_price
        FROM products p
        WHERE p.is_active = true
          AND lower(p.name) ILIKE '%' || v_word || '%'
        ORDER BY 
          CASE 
            WHEN lower(p.name) = v_word THEN 1
            WHEN lower(p.name) LIKE v_word || '%' THEN 2
            ELSE 3
          END,
          length(p.name)
        LIMIT 1;
      END IF;
      
      IF v_found_product_id IS NOT NULL THEN
        RAISE NOTICE '✅ وجدنا منتج عادي: %', v_found_product_name;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- ✅ الخطوة 3: البحث عن اللون المطلوب
  IF v_found_product_id IS NOT NULL THEN
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
    
    -- ✅ الخطوة 4: البحث عن الحجم المطلوب
    FOR v_word IN SELECT unnest(v_words)
    LOOP
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
  END IF;
  
  -- ✅ الخطوة 5: استخدام get_product_available_variants (هذا هو المفتاح!)
  IF v_found_product_id IS NOT NULL THEN
    SELECT get_product_available_variants(v_found_product_id, v_requested_color, v_requested_size) 
    INTO v_availability_info;
    
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
    
    RAISE NOTICE '✅ تم استخراج المنتج: % - اللون: % - الحجم: %', 
      v_found_product_name, 
      COALESCE(v_requested_color, 'غير محدد'), 
      COALESCE(v_requested_size, 'غير محدد');
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