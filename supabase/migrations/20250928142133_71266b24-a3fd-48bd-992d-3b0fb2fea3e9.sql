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
    v_requested_size := CASE lower(v_requested_size)
      WHEN 'سمول' OR 'صغير' OR 's' THEN 'S'
      WHEN 'ميديم' OR 'متوسط' OR 'وسط' OR 'm' THEN 'M'
      WHEN 'لارج' OR 'كبير' OR 'l' THEN 'L'
      WHEN 'xl' OR 'اكس' THEN 'XL'
      WHEN 'xxl' THEN 'XXL'
      ELSE upper(v_requested_size)
    END;
    
    -- العثور على معرف الحجم
    SELECT id INTO v_size_id FROM sizes WHERE upper(name) = upper(v_requested_size) LIMIT 1;
  END IF;
  
  -- فحص توفر المتغير المطلوب بدقة
  IF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
    SELECT pv.id, i.quantity INTO v_variant_id, v_stock_check
    FROM product_variants pv
    LEFT JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.product_id = v_found_product_id
      AND pv.color_id = v_color_id
      AND pv.size_id = v_size_id
      AND COALESCE(i.quantity, 0) > 0
    LIMIT 1;
    
    IF v_variant_id IS NOT NULL THEN
      v_exact_variant_available := true;
      RAISE NOTICE '✅ المتغير متوفر: % % (المخزون: %)', v_requested_color, v_requested_size, v_stock_check;
    ELSE
      RAISE NOTICE '❌ المتغير غير متوفر: % %', v_requested_color, v_requested_size;
    END IF;
  END IF;
  
  -- إذا كان المتغير المطلوب متوفراً، إرجاعه
  IF v_exact_variant_available THEN
    v_item_result := jsonb_build_object(
      'product_id', v_found_product_id,
      'product_name', v_found_product_name,
      'variant_id', v_variant_id,
      'color', v_requested_color,
      'size', v_requested_size,
      'quantity', 1,
      'unit_price', v_variant_price,
      'total_price', v_variant_price,
      'available_stock', v_stock_check
    );
    
    v_result := v_result || jsonb_build_array(v_item_result);
    RAISE NOTICE '✅ تم إضافة المتغير المطلوب إلى النتيجة';
    RETURN v_result;
  END IF;
  
  -- إذا لم يكن المتغير متوفراً، جمع البدائل المتوفرة
  v_available_variants_list := '';
  FOR v_color_name IN
    SELECT DISTINCT c.name
    FROM product_variants pv
    JOIN colors c ON pv.color_id = c.id
    JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.product_id = v_found_product_id
      AND COALESCE(i.quantity, 0) > 0
    ORDER BY c.name
  LOOP
    -- إضافة رمز تعبيري للون
    v_color_emoji := CASE lower(v_color_name)
      WHEN 'احمر' THEN '🔴'
      WHEN 'ازرق' THEN '🔵'
      WHEN 'اسود' THEN '⚫'
      WHEN 'ابيض' THEN '🤍'
      WHEN 'اصفر' THEN '🟡'
      WHEN 'اخضر' THEN '🟢'
      WHEN 'وردي' THEN '🩷'
      WHEN 'بنفسجي' THEN '🟣'
      WHEN 'برتقالي' THEN '🟠'
      WHEN 'بني' THEN '🟤'
      ELSE '🔘'
    END;
    
    -- جمع الأحجام المتوفرة لهذا اللون
    SELECT array_agg(s.name ORDER BY 
      CASE s.name 
        WHEN 'S' THEN 1
        WHEN 'M' THEN 2
        WHEN 'L' THEN 3
        WHEN 'XL' THEN 4
        WHEN 'XXL' THEN 5
        ELSE 6
      END
    ) INTO v_sizes_for_color
    FROM product_variants pv
    JOIN sizes s ON pv.size_id = s.id
    JOIN inventory i ON i.variant_id = pv.id
    WHERE pv.product_id = v_found_product_id
      AND pv.color_id = (SELECT id FROM colors WHERE name = v_color_name)
      AND COALESCE(i.quantity, 0) > 0;
    
    IF array_length(v_sizes_for_color, 1) > 0 THEN
      v_available_variants_list := v_available_variants_list || E'\n' || 
        v_color_emoji || ' ' || v_color_name || ' (' || array_to_string(v_sizes_for_color, ', ') || ')';
    END IF;
  END LOOP;
  
  -- إنشاء رسالة التنبيه مع البدائل
  v_alternatives_message := '❌ المنتج "' || v_found_product_name || '"';
  
  IF v_requested_color IS NOT NULL AND v_requested_size IS NOT NULL THEN
    v_alternatives_message := v_alternatives_message || ' غير متوفر باللون "' || v_requested_color || '" والحجم "' || v_requested_size || '".';
  ELSIF v_requested_color IS NOT NULL THEN
    v_alternatives_message := v_alternatives_message || ' غير متوفر باللون "' || v_requested_color || '".';
  ELSIF v_requested_size IS NOT NULL THEN
    v_alternatives_message := v_alternatives_message || ' غير متوفر بالحجم "' || v_requested_size || '".';
  ELSE
    v_alternatives_message := v_alternatives_message || ' غير متوفر.';
  END IF;
  
  IF v_available_variants_list != '' THEN
    v_alternatives_message := v_alternatives_message || E'\n\n✅ المتوفر فعلياً للمنتج "' || v_found_product_name || '":' || v_available_variants_list || E'\n\n💡 اختر اللون والمقاس المتوفر وأعد كتابة طلبك!';
  ELSE
    v_alternatives_message := v_alternatives_message || E'\n\n😞 عذراً، هذا المنتج غير متوفر حالياً.';
  END IF;
  
  -- إرجاع رسالة التنبيه والبدائل
  v_item_result := jsonb_build_object(
    'error', true,
    'product_name', v_found_product_name,
    'requested_color', v_requested_color,
    'requested_size', v_requested_size,
    'availability_message', v_alternatives_message,
    'alternatives_available', v_available_variants_list != ''
  );
  
  v_result := v_result || jsonb_build_array(v_item_result);
  
  RAISE NOTICE '⚠️ تم إرجاع رسالة التنبيه والبدائل المتوفرة';
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;