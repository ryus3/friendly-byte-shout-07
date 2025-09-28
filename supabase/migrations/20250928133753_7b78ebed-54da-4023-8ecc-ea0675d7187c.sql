-- تحسين دالة استخراج المنتجات لعرض البدائل الذكية
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
  v_color_emoji text;
  v_color_record record;
  v_size_record record;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات باستخدام regexp_split_to_array
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  
  -- استخدام regexp_split_to_array بدلاً من string_to_array لضمان التوافق
  SELECT array_agg(word) INTO v_words 
  FROM unnest(regexp_split_to_array(lower(trim(v_normalized_text)), '\s+')) AS word
  WHERE length(word) > 0;
  
  -- البحث عن المنتجات في النص
  FOR v_product IN 
    SELECT p.id, p.name, p.price, p.cost_price
    FROM products p
    WHERE p.is_active = true
    ORDER BY length(p.name) DESC
  LOOP
    -- فحص إذا كان اسم المنتج موجود في النص
    IF position(lower(v_product.name) in lower(v_normalized_text)) > 0 THEN
      v_found_product_id := v_product.id;
      v_found_product_name := v_product.name;
      v_found_product_price := COALESCE(v_product.price, 0);
      
      RAISE NOTICE '🎯 تم العثور على المنتج: % (ID: %)', v_found_product_name, v_found_product_id;
      
      -- البحث عن اللون المطلوب
      v_requested_color := NULL;
      FOREACH v_word IN ARRAY v_words
      LOOP
        -- فحص الألوان المباشرة
        IF v_word = ANY(v_color_keywords) THEN
          v_requested_color := v_word;
          EXIT;
        END IF;
        
        -- فحص الألوان من قاعدة البيانات
        SELECT c.name INTO v_requested_color
        FROM colors c
        WHERE lower(c.name) = v_word OR lower(c.name) LIKE '%' || v_word || '%'
        LIMIT 1;
        
        IF v_requested_color IS NOT NULL THEN
          EXIT;
        END IF;
      END LOOP;
      
      -- البحث عن المقاس المطلوب
      v_requested_size := NULL;
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF v_word = ANY(v_size_keywords) OR v_word ~ '^(xs|s|m|l|xl|xxl|xxxl)$' THEN
          v_requested_size := v_word;
          EXIT;
        END IF;
        
        -- فحص المقاسات من قاعدة البيانات
        SELECT s.name INTO v_requested_size
        FROM sizes s
        WHERE lower(s.name) = v_word OR lower(s.name) LIKE '%' || v_word || '%'
        LIMIT 1;
        
        IF v_requested_size IS NOT NULL THEN
          EXIT;
        END IF;
      END LOOP;
      
      RAISE NOTICE '🎨 اللون المطلوب: %, المقاس المطلوب: %', v_requested_color, v_requested_size;
      
      -- البحث عن المتغير المحدد (لون + مقاس)
      v_variant_id := NULL;
      v_stock_check := 0;
      
      IF v_requested_color IS NOT NULL AND v_requested_size IS NOT NULL THEN
        SELECT pv.id, COALESCE(i.quantity, 0) INTO v_variant_id, v_stock_check
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND (lower(c.name) = lower(v_requested_color) OR lower(c.name) LIKE '%' || lower(v_requested_color) || '%')
          AND (lower(s.name) = lower(v_requested_size) OR lower(s.name) LIKE '%' || lower(v_requested_size) || '%')
        LIMIT 1;
      ELSIF v_requested_color IS NOT NULL THEN
        SELECT pv.id, COALESCE(i.quantity, 0) INTO v_variant_id, v_stock_check
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND (lower(c.name) = lower(v_requested_color) OR lower(c.name) LIKE '%' || lower(v_requested_color) || '%')
        LIMIT 1;
      ELSIF v_requested_size IS NOT NULL THEN
        SELECT pv.id, COALESCE(i.quantity, 0) INTO v_variant_id, v_stock_check
        FROM product_variants pv
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND (lower(s.name) = lower(v_requested_size) OR lower(s.name) LIKE '%' || lower(v_requested_size) || '%')
        LIMIT 1;
      ELSE
        -- لا توجد مواصفات محددة، نأخذ أي متغير متوفر
        SELECT pv.id, COALESCE(i.quantity, 0) INTO v_variant_id, v_stock_check
        FROM product_variants pv
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND COALESCE(i.quantity, 0) > 0
        LIMIT 1;
      END IF;
      
      -- فحص توفر المخزون
      IF v_variant_id IS NOT NULL AND v_stock_check > 0 THEN
        v_exact_variant_available := true;
        RAISE NOTICE '✅ المتغير متوفر: % مع مخزون: %', v_variant_id, v_stock_check;
      ELSE
        v_exact_variant_available := false;
        RAISE NOTICE '❌ المتغير غير متوفر أو نفد المخزون';
        
        -- جمع البدائل المتوفرة للمنتج نفسه
        v_available_colors_sizes := '{}';
        
        FOR v_color_record IN
          SELECT DISTINCT c.name as color_name, c.id as color_id
          FROM product_variants pv
          JOIN colors c ON pv.color_id = c.id
          JOIN inventory i ON pv.id = i.variant_id
          WHERE pv.product_id = v_found_product_id
            AND i.quantity > 0
          ORDER BY c.name
        LOOP
          -- تحديد الرمز التعبيري للون
          v_color_emoji := CASE 
            WHEN lower(v_color_record.color_name) LIKE '%أبيض%' OR lower(v_color_record.color_name) LIKE '%ابيض%' OR lower(v_color_record.color_name) LIKE '%white%' THEN '⚪'
            WHEN lower(v_color_record.color_name) LIKE '%أسود%' OR lower(v_color_record.color_name) LIKE '%اسود%' OR lower(v_color_record.color_name) LIKE '%black%' THEN '⚫'
            WHEN lower(v_color_record.color_name) LIKE '%أحمر%' OR lower(v_color_record.color_name) LIKE '%احمر%' OR lower(v_color_record.color_name) LIKE '%red%' THEN '🔴'
            WHEN lower(v_color_record.color_name) LIKE '%أزرق%' OR lower(v_color_record.color_name) LIKE '%ازرق%' OR lower(v_color_record.color_name) LIKE '%blue%' THEN '🔵'
            WHEN lower(v_color_record.color_name) LIKE '%أخضر%' OR lower(v_color_record.color_name) LIKE '%اخضر%' OR lower(v_color_record.color_name) LIKE '%green%' THEN '🟢'
            WHEN lower(v_color_record.color_name) LIKE '%أصفر%' OR lower(v_color_record.color_name) LIKE '%اصفر%' OR lower(v_color_record.color_name) LIKE '%yellow%' THEN '🟡'
            WHEN lower(v_color_record.color_name) LIKE '%برتقالي%' OR lower(v_color_record.color_name) LIKE '%orange%' THEN '🟠'
            WHEN lower(v_color_record.color_name) LIKE '%وردي%' OR lower(v_color_record.color_name) LIKE '%pink%' THEN '🩷'
            WHEN lower(v_color_record.color_name) LIKE '%بنفسجي%' OR lower(v_color_record.color_name) LIKE '%purple%' THEN '🟣'
            WHEN lower(v_color_record.color_name) LIKE '%بني%' OR lower(v_color_record.color_name) LIKE '%brown%' THEN '🤎'
            ELSE '🎨'
          END;
          
          -- جمع المقاسات المتوفرة لهذا اللون
          SELECT array_agg(s.name ORDER BY 
            CASE 
              WHEN lower(s.name) = 'xs' THEN 1
              WHEN lower(s.name) = 's' OR lower(s.name) LIKE '%صغير%' THEN 2
              WHEN lower(s.name) = 'm' OR lower(s.name) LIKE '%متوسط%' OR lower(s.name) LIKE '%وسط%' THEN 3
              WHEN lower(s.name) = 'l' OR lower(s.name) LIKE '%كبير%' THEN 4
              WHEN lower(s.name) = 'xl' THEN 5
              WHEN lower(s.name) = 'xxl' THEN 6
              WHEN lower(s.name) = 'xxxl' THEN 7
              ELSE 8
            END
          ) INTO v_sizes_for_color
          FROM product_variants pv
          JOIN sizes s ON pv.size_id = s.id
          JOIN inventory i ON pv.id = i.variant_id
          WHERE pv.product_id = v_found_product_id
            AND pv.color_id = v_color_record.color_id
            AND i.quantity > 0;
          
          IF array_length(v_sizes_for_color, 1) > 0 THEN
            v_available_colors_sizes := v_available_colors_sizes || 
              jsonb_build_object(
                v_color_record.color_name, 
                jsonb_build_object(
                  'sizes', v_sizes_for_color,
                  'emoji', v_color_emoji
                )
              );
          END IF;
        END LOOP;
        
        -- تكوين رسالة البدائل الذكية
        IF v_available_colors_sizes != '{}' THEN
          v_alternatives_message := '❌ المنتج "' || v_found_product_name || '"';
          
          IF v_requested_color IS NOT NULL OR v_requested_size IS NOT NULL THEN
            v_alternatives_message := v_alternatives_message || ' غير متوفر';
            IF v_requested_color IS NOT NULL THEN
              v_alternatives_message := v_alternatives_message || ' باللون "' || v_requested_color || '"';
            END IF;
            IF v_requested_size IS NOT NULL THEN
              v_alternatives_message := v_alternatives_message || ' والحجم "' || v_requested_size || '"';
            END IF;
            v_alternatives_message := v_alternatives_message || '.';
          ELSE
            v_alternatives_message := v_alternatives_message || ' غير متوفر حالياً.';
          END IF;
          
          v_alternatives_message := v_alternatives_message || E'\n\n✅ المتوفر فعلياً للمنتج "' || v_found_product_name || '":' || E'\n';
          
          FOR v_color_name IN SELECT * FROM jsonb_object_keys(v_available_colors_sizes) LOOP
            v_alternatives_message := v_alternatives_message || 
              (v_available_colors_sizes->v_color_name->>'emoji') || ' ' || v_color_name || ' (';
            
            SELECT string_agg(size_val::text, ', ')
            INTO v_alternatives_message
            FROM (
              SELECT v_alternatives_message || string_agg(size_val::text, ', ')
              FROM jsonb_array_elements_text(v_available_colors_sizes->v_color_name->'sizes') AS size_val
            ) sub;
            
            -- تصحيح تجميع المقاسات
            SELECT v_alternatives_message || string_agg(size_val::text, ', ') || ')' || E'\n'
            INTO v_alternatives_message  
            FROM jsonb_array_elements_text(v_available_colors_sizes->v_color_name->'sizes') AS size_val;
          END LOOP;
          
          -- تصحيح بناء رسالة البدائل
          v_alternatives_message := '❌ المنتج "' || v_found_product_name || '"';
          
          IF v_requested_color IS NOT NULL OR v_requested_size IS NOT NULL THEN
            v_alternatives_message := v_alternatives_message || ' غير متوفر';
            IF v_requested_color IS NOT NULL THEN
              v_alternatives_message := v_alternatives_message || ' باللون "' || v_requested_color || '"';
            END IF;
            IF v_requested_size IS NOT NULL THEN
              v_alternatives_message := v_alternatives_message || ' والحجم "' || v_requested_size || '"';
            END IF;
            v_alternatives_message := v_alternatives_message || '.';
          ELSE
            v_alternatives_message := v_alternatives_message || ' غير متوفر حالياً.';
          END IF;
          
          v_alternatives_message := v_alternatives_message || E'\n\n✅ المتوفر فعلياً للمنتج "' || v_found_product_name || '":' || E'\n';
          
          -- بناء قائمة الألوان والمقاسات
          WITH color_sizes AS (
            SELECT 
              key as color_name,
              value->>'emoji' as emoji,
              value->'sizes' as sizes_array
            FROM jsonb_each(v_available_colors_sizes)
          )
          SELECT string_agg(
            emoji || ' ' || color_name || ' (' || 
            (SELECT string_agg(size_val::text, ', ') FROM jsonb_array_elements_text(sizes_array) AS size_val) ||
            ')', E'\n'
          ) INTO v_alternatives_message
          FROM (
            SELECT v_alternatives_message || string_agg(
              emoji || ' ' || color_name || ' (' || 
              (SELECT string_agg(size_val::text, ', ') FROM jsonb_array_elements_text(sizes_array) AS size_val) ||
              ')', E'\n'
            )
            FROM color_sizes
          ) sub;
          
        ELSE
          v_alternatives_message := '❌ المنتج "' || v_found_product_name || '" غير متوفر حالياً بجميع الألوان والمقاسات.';
        END IF;
        
        v_alternatives_data := jsonb_build_object(
          'message', v_alternatives_message,
          'available_alternatives', v_available_colors_sizes
        );
      END IF;
      
      -- إنشاء عنصر النتيجة
      v_item_result := jsonb_build_object(
        'product_id', v_found_product_id,
        'product_name', v_found_product_name,
        'variant_id', v_variant_id,
        'quantity', 1,
        'unit_price', v_found_product_price,
        'total_price', v_found_product_price,
        'requested_color', v_requested_color,
        'requested_size', v_requested_size,
        'available', v_exact_variant_available,
        'stock_quantity', COALESCE(v_stock_check, 0)
      );
      
      -- إضافة بيانات البدائل إذا لم يكن المتغير متوفراً
      IF NOT v_exact_variant_available THEN
        v_item_result := v_item_result || jsonb_build_object('alternatives', v_alternatives_data);
      END IF;
      
      v_result := v_result || jsonb_build_array(v_item_result);
      
      RAISE NOTICE '📦 تم إضافة عنصر: %', v_item_result;
      EXIT; -- توقف بعد العثور على أول منتج
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ انتهاء استخراج المنتجات: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;