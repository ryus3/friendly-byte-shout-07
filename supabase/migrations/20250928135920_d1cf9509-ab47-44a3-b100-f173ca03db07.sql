-- إعادة إنشاء دالة استخراج المنتجات كاملة مع الرد الذكي للبدائل
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
  v_color_name text;
  v_sizes_for_color text[];
  v_item_result jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المنتجات في النص
  FOR v_product IN 
    SELECT p.id, p.name, p.price 
    FROM products p 
    WHERE p.is_active = true
    ORDER BY LENGTH(p.name) DESC
  LOOP
    -- التحقق من وجود اسم المنتج في النص
    IF lower(input_text) ILIKE '%' || lower(v_product.name) || '%' THEN
      v_found_product_id := v_product.id;
      v_found_product_name := v_product.name;
      v_found_product_price := v_product.price;
      
      RAISE NOTICE '🎯 تم العثور على المنتج: % (ID: %)', v_found_product_name, v_found_product_id;
      
      -- البحث عن اللون المطلوب
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF v_word = ANY(v_color_keywords) THEN
          v_requested_color := v_word;
          RAISE NOTICE '🎨 اللون المطلوب: %', v_requested_color;
          EXIT;
        END IF;
      END LOOP;
      
      -- البحث عن المقاس المطلوب
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF v_word = ANY(v_size_keywords) THEN
          v_requested_size := v_word;
          RAISE NOTICE '📏 المقاس المطلوب: %', v_requested_size;
          EXIT;
        END IF;
      END LOOP;
      
      -- محاولة العثور على المتغير المحدد
      v_variant_id := NULL;
      v_color_id := NULL;
      v_size_id := NULL;
      
      -- البحث عن اللون
      IF v_requested_color IS NOT NULL THEN
        SELECT c.id INTO v_color_id 
        FROM colors c 
        WHERE lower(c.name) = v_requested_color 
        LIMIT 1;
      END IF;
      
      -- البحث عن المقاس
      IF v_requested_size IS NOT NULL THEN
        SELECT s.id INTO v_size_id 
        FROM sizes s 
        WHERE lower(s.name) = v_requested_size 
           OR (v_requested_size = 'ميديم' AND lower(s.name) = 'متوسط')
           OR (v_requested_size = 'لارج' AND lower(s.name) = 'كبير')
           OR (v_requested_size = 'سمول' AND lower(s.name) = 'صغير')
        LIMIT 1;
      END IF;
      
      -- البحث عن المتغير المحدد
      SELECT pv.id, COALESCE(i.quantity, 0) 
      INTO v_variant_id, v_stock_check
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      ORDER BY COALESCE(i.quantity, 0) DESC
      LIMIT 1;
      
      -- التحقق من توفر المخزون
      v_exact_variant_available := (v_variant_id IS NOT NULL AND v_stock_check > 0);
      
      -- جمع البدائل المتوفرة
      v_available_colors_sizes := '{}';
      
      -- جمع الألوان والمقاسات المتوفرة
      FOR v_color_name IN 
        SELECT DISTINCT c.name
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND COALESCE(i.quantity, 0) > 0
        ORDER BY c.name
      LOOP
        -- جمع المقاسات المتوفرة لكل لون
        SELECT array_agg(s.name ORDER BY s.name) INTO v_sizes_for_color
        FROM product_variants pv
        JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND pv.color_id = (SELECT id FROM colors WHERE name = v_color_name)
          AND COALESCE(i.quantity, 0) > 0;
        
        v_available_colors_sizes := jsonb_set(
          v_available_colors_sizes, 
          ARRAY[v_color_name], 
          to_jsonb(v_sizes_for_color)
        );
      END LOOP;
      
      -- بناء رسالة البدائل
      IF NOT v_exact_variant_available AND jsonb_object_keys(v_available_colors_sizes) IS NOT NULL THEN
        v_alternatives_message := '⚠️ ';
        
        IF v_requested_color IS NOT NULL AND v_requested_size IS NOT NULL THEN
          v_alternatives_message := v_alternatives_message || 'المنتج ' || v_found_product_name || ' غير متوفر باللون ' || v_requested_color || ' والمقاس ' || v_requested_size;
        ELSIF v_requested_color IS NOT NULL THEN
          v_alternatives_message := v_alternatives_message || 'المنتج ' || v_found_product_name || ' غير متوفر باللون ' || v_requested_color;
        ELSIF v_requested_size IS NOT NULL THEN
          v_alternatives_message := v_alternatives_message || 'المنتج ' || v_found_product_name || ' غير متوفر بالمقاس ' || v_requested_size;
        ELSE
          v_alternatives_message := v_alternatives_message || 'المنتج ' || v_found_product_name || ' غير متوفر بالمواصفات المطلوبة';
        END IF;
        
        v_alternatives_message := v_alternatives_message || E'\n\n✅ البدائل المتوفرة:\n';
        
        -- إضافة البدائل المتوفرة
        SELECT string_agg(
          '🎨 ' || key || ': ' || array_to_string(
            ARRAY(SELECT jsonb_array_elements_text(value)), 
            '، '
          ), 
          E'\n'
        ) INTO v_alternatives_message
        FROM jsonb_each(v_available_colors_sizes);
      END IF;
      
      -- بناء النتيجة
      IF v_exact_variant_available THEN
        -- المتغير متوفر
        v_item_result := jsonb_build_object(
          'product_id', v_found_product_id,
          'product_name', v_found_product_name,
          'variant_id', v_variant_id,
          'color_requested', v_requested_color,
          'size_requested', v_requested_size,
          'quantity', 1,
          'unit_price', v_found_product_price,
          'total_price', v_found_product_price,
          'available', true,
          'stock_quantity', v_stock_check
        );
      ELSE
        -- المتغير غير متوفر - عرض البدائل
        v_item_result := jsonb_build_object(
          'product_id', v_found_product_id,
          'product_name', v_found_product_name,
          'variant_id', v_variant_id,
          'color_requested', v_requested_color,
          'size_requested', v_requested_size,
          'quantity', 1,
          'unit_price', v_found_product_price,
          'total_price', 0, -- سعر 0 للمنتجات غير المتوفرة
          'available', false,
          'stock_quantity', COALESCE(v_stock_check, 0),
          'alternatives_message', v_alternatives_message,
          'available_options', v_available_colors_sizes
        );
      END IF;
      
      -- إضافة العنصر للنتيجة النهائية
      v_result := v_result || jsonb_build_array(v_item_result);
      
      RAISE NOTICE '✅ تم إضافة المنتج: %', v_item_result;
      
      -- إنهاء البحث بعد العثور على أول منتج
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم يتم العثور على أي منتجات
  IF jsonb_array_length(v_result) = 0 THEN
    RAISE NOTICE '❌ لم يتم العثور على أي منتجات في النص';
    v_result := jsonb_build_array(
      jsonb_build_object(
        'product_name', 'غير محدد',
        'available', false,
        'message', '⚠️ لم نتمكن من التعرف على المنتج المطلوب. يرجى التأكد من كتابة اسم المنتج بوضوح.'
      )
    );
  END IF;
  
  RAISE NOTICE '🏁 انتهاء استخراج المنتجات - النتيجة: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'error', true,
        'message', '⚠️ حدث خطأ في معالجة المنتجات. يرجى إعادة المحاولة.'
      )
    );
END;
$function$;