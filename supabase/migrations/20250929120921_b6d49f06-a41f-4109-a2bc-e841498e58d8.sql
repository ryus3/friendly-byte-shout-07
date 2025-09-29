-- إصلاح دالة extract_product_items_from_text - حل مشكلة SQL في البدائل
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_words text[];
  v_word text;
  v_product_items jsonb := '[]';
  v_quantity integer := 1;
  v_found_products text[] := '{}';
  v_found_colors text[] := '{}';
  v_found_sizes text[] := '{}';
  v_product_colors text[] := '{}';
  v_product_sizes text[] := '{}';
  v_normalized_text text;
  v_product_match record;
  v_color_match record;
  v_size_match record;
  v_variant_match record;
  v_item_data jsonb;
  v_available_colors_sizes jsonb;
  v_alternatives_message text := '';
  v_color_sizes_text text := '';
  v_color_entry text;
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- جمع الألوان والأحجام المتوفرة
  SELECT array_agg(DISTINCT lower(c.name)) INTO v_product_colors 
  FROM colors c WHERE c.name IS NOT NULL;
  
  SELECT array_agg(DISTINCT lower(s.name)) INTO v_product_sizes 
  FROM sizes s WHERE s.name IS NOT NULL;
  
  -- البحث عن أسماء المنتجات والألوان والأحجام في النص
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام
    IF length(v_word) < 2 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المنتجات
    FOR v_product_match IN 
      SELECT DISTINCT p.name, p.id
      FROM products p 
      WHERE (lower(p.name) LIKE '%' || v_word || '%' 
        OR v_word LIKE '%' || lower(p.name) || '%')
        AND p.is_active = true
      ORDER BY 
        CASE WHEN lower(p.name) = v_word THEN 1
             WHEN lower(p.name) LIKE v_word || '%' THEN 2
             WHEN lower(p.name) LIKE '%' || v_word || '%' THEN 3
             ELSE 4 END
      LIMIT 3
    LOOP
      v_found_products := array_append(v_found_products, v_product_match.name || ':' || v_product_match.id);
      RAISE NOTICE '🎯 تم العثور على المنتج: %', v_product_match.name;
    END LOOP;
    
    -- البحث عن الألوان
    IF v_word = ANY(v_product_colors) THEN
      FOR v_color_match IN 
        SELECT c.name, c.id FROM colors c 
        WHERE lower(c.name) = v_word
      LOOP
        v_found_colors := array_append(v_found_colors, v_color_match.name || ':' || v_color_match.id);
        RAISE NOTICE '🎨 تم العثور على اللون: %', v_color_match.name;
      END LOOP;
    END IF;
    
    -- البحث عن الأحجام
    IF v_word = ANY(v_product_sizes) THEN
      FOR v_size_match IN 
        SELECT s.name, s.id FROM sizes s 
        WHERE lower(s.name) = v_word OR lower(s.name) LIKE '%' || v_word || '%'
        ORDER BY 
          CASE WHEN lower(s.name) = v_word THEN 1 ELSE 2 END
        LIMIT 1
      LOOP
        v_found_sizes := array_append(v_found_sizes, v_size_match.name || ':' || v_size_match.id);
        RAISE NOTICE '📏 تم العثور على الحجم: %', v_size_match.name;
      END LOOP;
    END IF;
    
    -- البحث عن الكمية
    IF v_word ~ '^[0-9]+$' AND v_word::integer BETWEEN 1 AND 100 THEN
      v_quantity := v_word::integer;
      RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
    END IF;
  END LOOP;
  
  -- معالجة كل منتج تم العثور عليه
  IF array_length(v_found_products, 1) > 0 THEN
    DECLARE
      v_product_entry text;
      v_product_name text;
      v_product_id uuid;
      v_color_entry text;
      v_color_name text;
      v_color_id uuid;
      v_size_entry text;
      v_size_name text;
      v_size_id uuid;
    BEGIN
      -- معالجة أول منتج فقط
      v_product_entry := v_found_products[1];
      v_product_name := split_part(v_product_entry, ':', 1);
      v_product_id := split_part(v_product_entry, ':', 2)::uuid;
      
      -- تحديد اللون والحجم
      IF array_length(v_found_colors, 1) > 0 THEN
        v_color_entry := v_found_colors[1];
        v_color_name := split_part(v_color_entry, ':', 1);
        v_color_id := split_part(v_color_entry, ':', 2)::uuid;
      END IF;
      
      IF array_length(v_found_sizes, 1) > 0 THEN
        v_size_entry := v_found_sizes[1];
        v_size_name := split_part(v_size_entry, ':', 1);
        v_size_id := split_part(v_size_entry, ':', 2)::uuid;
      END IF;
      
      -- البحث عن المتغير المطلوب
      SELECT pv.id, pv.price, i.quantity
      INTO v_variant_match
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product_id
        AND (v_color_id IS NULL OR pv.color_id = v_color_id)
        AND (v_size_id IS NULL OR pv.size_id = v_size_id)
      LIMIT 1;
      
      -- بناء عنصر الطلب
      IF v_variant_match.id IS NOT NULL AND COALESCE(v_variant_match.quantity, 0) >= v_quantity THEN
        -- المنتج متوفر
        v_item_data := jsonb_build_object(
          'product_name', v_product_name,
          'color_name', COALESCE(v_color_name, 'افتراضي'),
          'size_name', COALESCE(v_size_name, 'افتراضي'),
          'quantity', v_quantity,
          'price', COALESCE(v_variant_match.price, 15000),
          'total_price', COALESCE(v_variant_match.price, 15000) * v_quantity,
          'is_available', true,
          'alternatives_message', ''
        );
        
        RAISE NOTICE '✅ المنتج متوفر: % - % - %', v_product_name, v_color_name, v_size_name;
      ELSE
        -- المنتج غير متوفر - جلب البدائل المتوفرة (إصلاح خطأ SQL)
        RAISE NOTICE '❌ المنتج غير متوفر، سيتم جلب البدائل...';
        
        -- جلب جميع المتغيرات المتوفرة لهذا المنتج - حل مبسط بدون GROUP BY مشكل
        SELECT jsonb_object_agg(
          color_name, 
          sizes_array
        ) INTO v_available_colors_sizes
        FROM (
          SELECT 
            c.name as color_name,
            jsonb_agg(s.name) as sizes_array
          FROM product_variants pv
          JOIN colors c ON pv.color_id = c.id
          JOIN sizes s ON pv.size_id = s.id
          LEFT JOIN inventory i ON pv.id = i.variant_id
          WHERE pv.product_id = v_product_id
            AND COALESCE(i.quantity, 0) > 0
          GROUP BY c.name
        ) grouped;
        
        RAISE NOTICE '🎨 البدائل المتوفرة: %', v_available_colors_sizes;
        
        -- بناء رسالة البدائل الذكية
        IF v_available_colors_sizes IS NOT NULL AND jsonb_typeof(v_available_colors_sizes) = 'object' THEN
          v_alternatives_message := format('❌ اللون "%s" غير متوفر لمنتج "%s"', 
            COALESCE(v_color_name, 'المطلوب'), v_product_name) || E'\n\n';
          v_alternatives_message := v_alternatives_message || '✅ 🎨 الألوان والأحجام المتوفرة:' || E'\n';
          
          -- بناء قائمة الألوان والأحجام
          FOR v_color_entry IN SELECT jsonb_object_keys(v_available_colors_sizes)
          LOOP
            SELECT string_agg(size_val, ', ')
            INTO v_color_sizes_text
            FROM jsonb_array_elements_text(v_available_colors_sizes->v_color_entry) AS size_val;
            
            v_alternatives_message := v_alternatives_message || format('• %s : %s', 
              v_color_entry, v_color_sizes_text) || E'\n';
          END LOOP;
        ELSE
          v_alternatives_message := format('❌ المنتج "%s" غير متوفر بأي مواصفات حالياً.', v_product_name);
        END IF;
        
        -- بناء عنصر غير متوفر
        v_item_data := jsonb_build_object(
          'product_name', v_product_name,
          'color_name', COALESCE(v_color_name, 'افتراضي'),
          'size_name', COALESCE(v_size_name, 'افتراضي'),
          'quantity', v_quantity,
          'price', 15000,
          'total_price', 15000 * v_quantity,
          'is_available', false,
          'alternatives_message', v_alternatives_message
        );
        
        RAISE NOTICE '📝 رسالة البدائل: %', v_alternatives_message;
      END IF;
      
      v_product_items := jsonb_build_array(v_item_data);
    END;
  END IF;
  
  -- إذا لم يتم العثور على منتجات
  IF v_product_items = '[]' THEN
    RAISE NOTICE '⚠️ لم يتم العثور على منتجات في النص';
    v_product_items := jsonb_build_array(
      jsonb_build_object(
        'product_name', 'غير محدد',
        'color_name', 'افتراضي', 
        'size_name', 'افتراضي',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'لم يتم التعرف على أي منتج في الطلب. يرجى كتابة اسم المنتج بوضوح.'
      )
    );
  END IF;
  
  RAISE NOTICE '✅ انتهاء استخراج المنتجات. العدد: %', jsonb_array_length(v_product_items);
  RETURN v_product_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ',
        'color_name', 'افتراضي',
        'size_name', 'افتراضي', 
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'حدث خطأ في معالجة طلبك: ' || SQLERRM
      )
    );
END;
$function$;