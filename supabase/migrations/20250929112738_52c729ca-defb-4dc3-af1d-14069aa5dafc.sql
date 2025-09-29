-- حذف الدالة القديمة وإنشاؤها بالتحسينات الجديدة
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

-- إنشاء دالة محسّنة للتحقق الذكي من المخزون المتاح
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
  v_alternatives_message text := '';
  v_available_colors_sizes jsonb := '{}';
  v_color_name text;
  v_sizes_for_color text[];
  v_item_result jsonb;
  v_color_in_db text;
  v_size_in_db text;
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  
  v_words := regexp_split_to_array(lower(trim(v_normalized_text)), E'\\s+');
  RAISE NOTICE '📝 الكلمات المستخرجة: %', v_words;
  
  -- البحث عن المنتج أولاً
  FOR v_word IN SELECT unnest(v_words)
  LOOP
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
    
    -- إذا وجدنا منتج، نخرج من حلقة البحث
    IF v_found_product_id IS NOT NULL THEN
      RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_found_product_name, v_found_product_id;
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم نجد أي منتج، أرجع رسالة خطأ
  IF v_found_product_id IS NULL THEN
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'لم يتم العثور على المنتج',
        'color_name', 'غير محدد',
        'size_name', 'غير محدد',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'لم يتم التعرف على المنتج المطلوب. يرجى التأكد من اسم المنتج.'
      )
    );
  END IF;
  
  -- استخراج اللون المطلوب
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    FOR i IN 1..array_length(v_color_keywords, 1)
    LOOP
      IF v_word ILIKE '%' || v_color_keywords[i] || '%' THEN
        v_requested_color := v_color_keywords[i];
        RAISE NOTICE '🎨 تم العثور على اللون المطلوب: %', v_requested_color;
        EXIT;
      END IF;
    END LOOP;
    EXIT WHEN v_requested_color IS NOT NULL;
  END LOOP;
  
  -- استخراج الحجم المطلوب
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
  
  RAISE NOTICE '📏 الحجم المطلوب: %', v_requested_size;
  
  -- العثور على معرفات اللون والحجم في قاعدة البيانات
  IF v_requested_color IS NOT NULL THEN
    SELECT c.id, c.name INTO v_color_id, v_color_in_db
    FROM colors c
    WHERE lower(c.name) ILIKE '%' || v_requested_color || '%'
       OR v_requested_color ILIKE '%' || lower(c.name) || '%'
    ORDER BY 
      CASE 
        WHEN lower(c.name) = lower(v_requested_color) THEN 1
        ELSE 2
      END
    LIMIT 1;
  END IF;
  
  IF v_requested_size IS NOT NULL THEN
    SELECT s.id, s.name INTO v_size_id, v_size_in_db
    FROM sizes s
    WHERE lower(s.name) ILIKE '%' || v_requested_size || '%'
       OR v_requested_size ILIKE '%' || lower(s.name) || '%'
    ORDER BY 
      CASE 
        WHEN lower(s.name) = lower(v_requested_size) THEN 1
        ELSE 2
      END
    LIMIT 1;
  END IF;
  
  -- فحص المتغير المطلوب بالضبط
  IF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
    SELECT pv.id INTO v_variant_id
    FROM product_variants pv
    WHERE pv.product_id = v_found_product_id
      AND pv.color_id = v_color_id
      AND pv.size_id = v_size_id
      AND pv.is_active = true
    LIMIT 1;
    
    -- فحص المخزون للمتغير المحدد
    IF v_variant_id IS NOT NULL THEN
      SELECT (quantity - COALESCE(reserved_quantity, 0)) INTO v_stock_check
      FROM inventory
      WHERE variant_id = v_variant_id;
      
      v_exact_variant_available := (COALESCE(v_stock_check, 0) > 0);
      RAISE NOTICE '📊 المخزون للمتغير المحدد (%، %): %', v_color_in_db, v_size_in_db, v_stock_check;
    ELSE
      RAISE NOTICE '❌ المتغير المطلوب غير موجود: % + %', v_color_in_db, v_size_in_db;
      v_exact_variant_available := false;
    END IF;
  ELSE
    v_exact_variant_available := false;
    RAISE NOTICE '❌ اللون أو الحجم المطلوب غير موجود في قاعدة البيانات';
  END IF;
  
  -- بناء قائمة البدائل المتوفرة فقط (المخزون > 0)
  BEGIN
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN '{}'::jsonb
        ELSE jsonb_object_agg(
          COALESCE(c.name, 'افتراضي'), 
          available_sizes
        )
      END INTO v_available_colors_sizes
    FROM (
      SELECT 
        pv.color_id,
        c.name,
        array_agg(DISTINCT COALESCE(s.name, 'افتراضي')) FILTER (WHERE (i.quantity - COALESCE(i.reserved_quantity, 0)) > 0) as available_sizes
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND pv.is_active = true
      GROUP BY pv.color_id, c.name
      HAVING array_length(array_agg(DISTINCT COALESCE(s.name, 'افتراضي')) FILTER (WHERE (i.quantity - COALESCE(i.reserved_quantity, 0)) > 0), 1) > 0
    ) color_sizes;
  EXCEPTION
    WHEN OTHERS THEN
      v_available_colors_sizes := '{}'::jsonb;
      RAISE NOTICE '⚠️ خطأ في بناء قائمة البدائل: %', SQLERRM;
  END;
  
  -- بناء رسالة البدائل الذكية
  IF NOT v_exact_variant_available THEN
    IF jsonb_typeof(v_available_colors_sizes) = 'object' AND v_available_colors_sizes != '{}'::jsonb THEN
      -- رسالة مخصصة حسب السبب
      IF v_requested_color IS NOT NULL AND v_color_id IS NULL THEN
        v_alternatives_message := '❌ اللون "' || v_requested_color || '" غير متوفر لمنتج "' || v_found_product_name || '"' || E'\n\n';
      ELSIF v_requested_size IS NOT NULL AND v_size_id IS NULL THEN
        v_alternatives_message := '❌ الحجم "' || v_requested_size || '" غير متوفر لمنتج "' || v_found_product_name || '"' || E'\n\n';
      ELSIF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
        v_alternatives_message := '❌ المواصفات "' || v_color_in_db || ' - ' || v_size_in_db || '" غير متوفرة لمنتج "' || v_found_product_name || '"' || E'\n\n';
      ELSE
        v_alternatives_message := '❌ المواصفات المطلوبة غير متوفرة لمنتج "' || v_found_product_name || '"' || E'\n\n';
      END IF;
      
      v_alternatives_message := v_alternatives_message || '🎨 الألوان والأحجام المتوفرة:' || E'\n';
      
      FOR v_color_name IN SELECT jsonb_object_keys(v_available_colors_sizes)
      LOOP
        SELECT array_agg(elem::text) INTO v_sizes_for_color
        FROM jsonb_array_elements_text(v_available_colors_sizes->v_color_name) elem;
        
        IF v_sizes_for_color IS NOT NULL AND array_length(v_sizes_for_color, 1) > 0 THEN
          v_alternatives_message := v_alternatives_message || 
            '• ' || v_color_name || ' - الأحجام: ' || array_to_string(v_sizes_for_color, ', ') || E'\n';
        END IF;
      END LOOP;
    ELSE
      v_alternatives_message := '❌ المنتج "' || v_found_product_name || '" غير متوفر بأي مواصفات حالياً.';
    END IF;
  END IF;
  
  -- بناء النتيجة النهائية
  v_item_result := jsonb_build_object(
    'product_name', v_found_product_name,
    'color_name', COALESCE(v_color_in_db, v_requested_color, 'غير محدد'),
    'size_name', COALESCE(v_size_in_db, v_requested_size, 'غير محدد'),
    'quantity', 1,
    'price', COALESCE(v_found_product_price, 0),
    'total_price', COALESCE(v_found_product_price, 0),
    'is_available', v_exact_variant_available,
    'alternatives_message', v_alternatives_message
  );
  
  v_result := v_result || jsonb_build_array(v_item_result);
  
  RAISE NOTICE '🎯 النتيجة النهائية: %', v_item_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ في المعالجة',
        'color_name', 'غير محدد',
        'size_name', 'غير محدد',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة.'
      )
    );
END;
$function$;