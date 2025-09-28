-- إصلاح دالة استخراج المنتجات نهائياً
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
  v_variant_price numeric;
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
      v_variant_price := v_found_product_price;
      
      -- البحث عن اللون
      IF v_requested_color IS NOT NULL THEN
        SELECT c.id INTO v_color_id 
        FROM colors c 
        WHERE lower(c.name) = v_requested_color 
           OR (v_requested_color = 'ازرق' AND lower(c.name) = 'أزرق')
           OR (v_requested_color = 'احمر' AND lower(c.name) = 'أحمر')
           OR (v_requested_color = 'اسود' AND lower(c.name) = 'أسود')
           OR (v_requested_color = 'ابيض' AND lower(c.name) = 'أبيض')
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
      SELECT pv.id, COALESCE(i.quantity, 0), COALESCE(pv.price, v_found_product_price)
      INTO v_variant_id, v_stock_check, v_variant_price
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      ORDER BY COALESCE(i.quantity, 0) DESC
      LIMIT 1;
      
      -- إذا تم العثور على المتغير والمخزون متوفر
      IF v_variant_id IS NOT NULL AND v_stock_check > 0 THEN
        v_exact_variant_available := true;
        RAISE NOTICE '✅ تم العثور على المتغير المطلوب مع مخزون متوفر: %', v_variant_id;
        
        v_item_result := jsonb_build_object(
          'product_id', v_found_product_id,
          'product_name', v_found_product_name,
          'variant_id', v_variant_id,
          'quantity', 1,
          'unit_price', v_variant_price,
          'total_price', v_variant_price,
          'color', COALESCE(v_requested_color, 'افتراضي'),
          'size', COALESCE(v_requested_size, 'افتراضي'),
          'stock_available', v_stock_check,
          'error', false
        );
      ELSE
        -- لا يوجد المتغير المطلوب أو لا يوجد مخزون
        RAISE NOTICE '⚠️ المتغير المطلوب غير متوفر، البحث عن بدائل...';
        
        -- جمع البدائل المتوفرة
        SELECT jsonb_object_agg(
          c.name,
          COALESCE(
            (SELECT jsonb_agg(s.name ORDER BY s.name)
             FROM product_variants pv2
             JOIN sizes s ON pv2.size_id = s.id
             LEFT JOIN inventory i2 ON pv2.id = i2.variant_id
             WHERE pv2.product_id = v_found_product_id
               AND pv2.color_id = c.id
               AND COALESCE(i2.quantity, 0) > 0),
            '[]'::jsonb
          )
        ) INTO v_available_colors_sizes
        FROM colors c
        WHERE c.id IN (
          SELECT DISTINCT pv.color_id
          FROM product_variants pv
          LEFT JOIN inventory i ON pv.id = i.variant_id
          WHERE pv.product_id = v_found_product_id
            AND COALESCE(i.quantity, 0) > 0
        );
        
        -- بناء رسالة البدائل
        v_alternatives_message := '💡 البدائل المتوفرة لـ ' || v_found_product_name || ':' || chr(10);
        
        FOR v_color_name IN 
          SELECT jsonb_object_keys(v_available_colors_sizes)
        LOOP
          SELECT jsonb_array_elements_text(v_available_colors_sizes->v_color_name) INTO v_sizes_for_color;
          v_alternatives_message := v_alternatives_message || '🎨 ' || v_color_name || ': ';
          
          IF jsonb_array_length(v_available_colors_sizes->v_color_name) > 0 THEN
            SELECT string_agg(size_name, '، ')
            INTO v_alternatives_message
            FROM (
              SELECT jsonb_array_elements_text(v_available_colors_sizes->v_color_name) as size_name
            ) sizes;
          ELSE
            v_alternatives_message := v_alternatives_message || 'غير متوفر';
          END IF;
          
          v_alternatives_message := v_alternatives_message || chr(10);
        END LOOP;
        
        v_item_result := jsonb_build_object(
          'product_id', v_found_product_id,
          'product_name', v_found_product_name,
          'requested_color', COALESCE(v_requested_color, 'غير محدد'),
          'requested_size', COALESCE(v_requested_size, 'غير محدد'),
          'error', true,
          'message', v_alternatives_message,
          'alternatives', v_available_colors_sizes,
          'unit_price', v_variant_price,
          'total_price', 0
        );
      END IF;
      
      -- إضافة العنصر إلى النتيجة
      v_result := v_result || jsonb_build_array(v_item_result);
      RAISE NOTICE '📦 تم إضافة عنصر: %', v_item_result;
      
      -- العثور على منتج واحد فقط (أول منتج)
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم يتم العثور على أي منتج
  IF jsonb_array_length(v_result) = 0 THEN
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
    v_result := jsonb_build_array(
      jsonb_build_object(
        'error', true,
        'message', '❌ لم يتم التعرف على أي منتج في النص المرسل. يرجى كتابة اسم منتج صحيح.',
        'requested_text', input_text
      )
    );
  END IF;
  
  RAISE NOTICE '✅ انتهاء المعالجة، النتيجة: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة النص: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'error', true,
        'message', '⚠️ حدث خطأ في معالجة المنتجات. يرجى إعادة المحاولة.',
        'details', SQLERRM
      )
    );
END;
$function$;