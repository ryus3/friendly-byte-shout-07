-- إصلاح دالة استخراج المنتجات لاستعادة الوظيفة الأساسية مع إضافة التحقق الذكي
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
  v_color_keywords text[] := ARRAY['احمر', 'أحمر', 'ازرق', 'أزرق', 'اسود', 'أسود', 'ابيض', 'أبيض', 'اصفر', 'أصفر', 'اخضر', 'أخضر', 'بنفسجي', 'وردي', 'رمادي', 'بني', 'برتقالي', 'سمائي', 'نيلي'];
  v_size_keywords text[] := ARRAY['سمول', 'صغير', 'ميديم', 'متوسط', 'وسط', 'لارج', 'كبير', 'اكس', 'xl', 'xxl', 's', 'm', 'l'];
  v_found_product_id uuid;
  v_found_product_name text;
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
  v_color_name text;
  v_sizes_for_color text[];
  v_item_result jsonb;
  v_variant_price numeric := 20000; -- سعر افتراضي
  v_available_variants_list text := '';
  v_color_emoji text;
  v_fallback_variant record;
  v_best_match_variant record;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المنتج في النص
  FOR v_product IN
    SELECT p.id, p.name, p.selling_price
    FROM products p
    WHERE p.is_active = true
    ORDER BY length(p.name) DESC
  LOOP
    IF lower(v_normalized_text) LIKE '%' || lower(v_product.name) || '%' THEN
      v_found_product_id := v_product.id;
      v_found_product_name := v_product.name;
      v_variant_price := COALESCE(v_product.selling_price, 20000);
      RAISE NOTICE '🎯 تم العثور على المنتج: % (ID: %)', v_found_product_name, v_found_product_id;
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم يتم العثور على منتج، إرجاع فارغ
  IF v_found_product_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
    RETURN v_result;
  END IF;
  
  -- البحث عن اللون والحجم المطلوبين
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث عن اللون
    IF v_requested_color IS NULL AND v_word = ANY(v_color_keywords) THEN
      v_requested_color := v_word;
      RAISE NOTICE '🎨 تم العثور على اللون المطلوب: %', v_requested_color;
    END IF;
    
    -- البحث عن الحجم
    IF v_requested_size IS NULL AND v_word = ANY(v_size_keywords) THEN
      v_requested_size := v_word;
      RAISE NOTICE '📏 تم العثور على الحجم المطلوب: %', v_requested_size;
    END IF;
  END LOOP;
  
  -- تطبيع اللون والحجم المطلوبين
  IF v_requested_color IS NOT NULL THEN
    -- تطبيع اللون إلى اسم قاعدة البيانات
    v_requested_color := CASE v_requested_color
      WHEN 'احمر' OR 'أحمر' THEN 'احمر'
      WHEN 'ازرق' OR 'أزرق' THEN 'ازرق'
      WHEN 'اسود' OR 'أسود' THEN 'اسود'
      WHEN 'ابيض' OR 'أبيض' THEN 'ابيض'
      WHEN 'اصفر' OR 'أصفر' THEN 'اصفر'
      WHEN 'اخضر' OR 'أخضر' THEN 'اخضر'
      ELSE v_requested_color
    END;
    
    -- العثور على معرف اللون
    SELECT id INTO v_color_id FROM colors WHERE lower(name) = lower(v_requested_color) LIMIT 1;
  END IF;
  
  IF v_requested_size IS NOT NULL THEN
    -- تطبيع الحجم إلى اسم قاعدة البيانات
    v_requested_size := CASE v_requested_size
      WHEN 'سمول' OR 'صغير' OR 's' THEN 'S'
      WHEN 'ميديم' OR 'متوسط' OR 'وسط' OR 'm' THEN 'M'
      WHEN 'لارج' OR 'كبير' OR 'l' THEN 'L'
      WHEN 'اكس' OR 'xl' THEN 'XL'
      WHEN 'xxl' THEN 'XXL'
      ELSE UPPER(v_requested_size)
    END;
    
    -- العثور على معرف الحجم
    SELECT id INTO v_size_id FROM sizes WHERE UPPER(name) = UPPER(v_requested_size) LIMIT 1;
  END IF;
  
  -- المحاولة الأولى: البحث عن المتغير المحدد بدقة (إذا كان اللون والحجم محددين)
  IF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
    SELECT pv.id, pv.selling_price, 
           COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_stock
    INTO v_best_match_variant
    FROM product_variants pv
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_found_product_id
      AND pv.color_id = v_color_id
      AND pv.size_id = v_size_id
      AND pv.is_active = true;
    
    IF v_best_match_variant.id IS NOT NULL THEN
      v_variant_id := v_best_match_variant.id;
      v_variant_price := COALESCE(v_best_match_variant.selling_price, v_variant_price);
      v_stock_check := v_best_match_variant.available_stock;
      v_exact_variant_available := true;
      RAISE NOTICE '✅ تم العثور على المتغير المحدد بدقة: %', v_variant_id;
    END IF;
  END IF;
  
  -- إذا لم نجد المتغير المحدد أو لم يكن محدداً، نبحث عن أي متغير متوفر
  IF v_variant_id IS NULL THEN
    -- البحث عن أفضل متغير متوفر
    SELECT pv.id, pv.selling_price, 
           COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_stock
    INTO v_fallback_variant
    FROM product_variants pv
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_found_product_id
      AND pv.is_active = true
      AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
    ORDER BY COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) DESC
    LIMIT 1;
    
    IF v_fallback_variant.id IS NOT NULL THEN
      v_variant_id := v_fallback_variant.id;
      v_variant_price := COALESCE(v_fallback_variant.selling_price, v_variant_price);
      v_stock_check := v_fallback_variant.available_stock;
      RAISE NOTICE '✅ تم العثور على متغير بديل متوفر: %', v_variant_id;
    ELSE
      -- لا توجد متغيرات متوفرة - نأخذ أول متغير حتى لو غير متوفر
      SELECT pv.id, pv.selling_price, 
             COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) as available_stock
      INTO v_fallback_variant
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND pv.is_active = true
      LIMIT 1;
      
      IF v_fallback_variant.id IS NOT NULL THEN
        v_variant_id := v_fallback_variant.id;
        v_variant_price := COALESCE(v_fallback_variant.selling_price, v_variant_price);
        v_stock_check := v_fallback_variant.available_stock;
        RAISE NOTICE '⚠️ تم اختيار متغير غير متوفر: %', v_variant_id;
      END IF;
    END IF;
  END IF;
  
  -- إذا لم نجد أي متغير، إنشاء عنصر أساسي
  IF v_variant_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على أي متغير، إنشاء عنصر أساسي';
    v_stock_check := 0;
  END IF;
  
  -- إنشاء النتيجة
  v_item_result := jsonb_build_object(
    'product_id', v_found_product_id,
    'product_name', v_found_product_name,
    'variant_id', v_variant_id,
    'quantity', 1,
    'unit_price', v_variant_price,
    'total_price', v_variant_price,
    'available_stock', COALESCE(v_stock_check, 0),
    'requested_color', v_requested_color,
    'requested_size', v_requested_size
  );
  
  -- إضافة تحذير إذا كان المتغير المحدد بدقة غير متوفر
  IF v_requested_color IS NOT NULL AND v_requested_size IS NOT NULL AND NOT v_exact_variant_available THEN
    -- جمع البدائل المتوفرة
    SELECT jsonb_agg(
      jsonb_build_object(
        'color', c.name,
        'size', s.name,
        'stock', COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0),
        'price', COALESCE(pv.selling_price, v_variant_price)
      )
    ) INTO v_alternatives_data
    FROM product_variants pv
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_found_product_id
      AND pv.is_active = true
      AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0;
    
    v_item_result := jsonb_set(v_item_result, '{alternatives}', COALESCE(v_alternatives_data, '[]'));
    v_item_result := jsonb_set(v_item_result, '{has_alternatives}', 'true');
  END IF;
  
  -- إضافة العنصر إلى النتيجة
  v_result := v_result || jsonb_build_array(v_item_result);
  
  RAISE NOTICE '✅ تم إنشاء عنصر المنتج: %', v_item_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    -- في حالة الخطأ، نعيد عنصراً أساسياً على الأقل
    IF v_found_product_id IS NOT NULL THEN
      v_item_result := jsonb_build_object(
        'product_id', v_found_product_id,
        'product_name', v_found_product_name,
        'variant_id', NULL,
        'quantity', 1,
        'unit_price', v_variant_price,
        'total_price', v_variant_price,
        'available_stock', 0,
        'error', 'حدث خطأ في معالجة المنتج'
      );
      RETURN jsonb_build_array(v_item_result);
    END IF;
    RETURN '[]'::jsonb;
END;
$function$;