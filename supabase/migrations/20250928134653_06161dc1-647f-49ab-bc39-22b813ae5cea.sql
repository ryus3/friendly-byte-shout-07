-- استعادة النسخة الأصلية العاملة من دالة extract_product_items_from_text

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
      
      -- البحث عن المتغير المحدد
      v_variant_id := NULL;
      v_color_id := NULL;
      v_size_id := NULL;
      v_exact_variant_available := false;
      
      -- الحصول على معرفات اللون والمقاس
      IF v_requested_color IS NOT NULL THEN
        SELECT c.id INTO v_color_id
        FROM colors c
        WHERE lower(c.name) = lower(v_requested_color) OR lower(c.name) LIKE '%' || lower(v_requested_color) || '%'
        LIMIT 1;
      END IF;
      
      IF v_requested_size IS NOT NULL THEN
        SELECT s.id INTO v_size_id
        FROM sizes s
        WHERE lower(s.name) = lower(v_requested_size) OR lower(s.name) LIKE '%' || lower(v_requested_size) || '%'
        LIMIT 1;
      END IF;
      
      -- البحث عن المتغير المحدد والتحقق من المخزون
      IF v_color_id IS NOT NULL AND v_size_id IS NOT NULL THEN
        SELECT pv.id, COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0)
        INTO v_variant_id, v_stock_check
        FROM product_variants pv
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_found_product_id
          AND pv.color_id = v_color_id
          AND pv.size_id = v_size_id
          AND pv.is_active = true
        LIMIT 1;
        
        IF v_variant_id IS NOT NULL AND v_stock_check > 0 THEN
          v_exact_variant_available := true;
          RAISE NOTICE '✅ المتغير متوفر: % (المخزون: %)', v_variant_id, v_stock_check;
        ELSE
          RAISE NOTICE '❌ المتغير غير متوفر أو نفد من المخزون';
        END IF;
      END IF;
      
      -- إذا لم يكن المتغير المحدد متوفراً، جمع البدائل المتوفرة
      IF NOT v_exact_variant_available THEN
        v_alternatives_data := '{}';
        v_alternatives_message := '';
        
        -- جمع الألوان والمقاسات المتوفرة لهذا المنتج
        SELECT jsonb_object_agg(c.name, size_data)
        INTO v_alternatives_data
        FROM (
          SELECT 
            c.name,
            jsonb_agg(s.name ORDER BY s.name) as size_data
          FROM product_variants pv
          JOIN colors c ON pv.color_id = c.id
          JOIN sizes s ON pv.size_id = s.id
          LEFT JOIN inventory i ON pv.id = i.variant_id
          WHERE pv.product_id = v_found_product_id
            AND pv.is_active = true
            AND COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0) > 0
          GROUP BY c.id, c.name
        ) sub
        JOIN colors c ON c.name = sub.name;
        
        -- بناء رسالة البدائل
        IF v_alternatives_data IS NOT NULL AND jsonb_typeof(v_alternatives_data) = 'object' THEN
          v_alternatives_message := '🛒 ' || v_found_product_name || ' متوفر بالألوان والمقاسات التالية:\n\n';
          
          FOR v_color_name IN SELECT jsonb_object_keys(v_alternatives_data)
          LOOP
            SELECT jsonb_agg(size_name)
            INTO v_sizes_for_color
            FROM jsonb_array_elements_text(v_alternatives_data->v_color_name) AS size_name;
            
            v_alternatives_message := v_alternatives_message || 
              '🎨 ' || v_color_name || ': ' || array_to_string(v_sizes_for_color, '، ') || '\n';
          END LOOP;
          
          v_alternatives_message := v_alternatives_message || '\n💡 يرجى تحديد اللون والمقاس المطلوب من البدائل المتوفرة.';
        ELSE
          v_alternatives_message := '❌ عذراً، المنتج ' || v_found_product_name || ' غير متوفر حالياً في المخزون.';
        END IF;
      END IF;
      
      -- بناء النتيجة للعنصر
      v_item_result := jsonb_build_object(
        'product_id', v_found_product_id,
        'product_name', v_found_product_name,
        'variant_id', v_variant_id,
        'requested_color', v_requested_color,
        'requested_size', v_requested_size,
        'quantity', 1,
        'unit_price', v_found_product_price,
        'total_price', v_found_product_price,
        'available', v_exact_variant_available,
        'alternatives_message', CASE 
          WHEN v_exact_variant_available THEN NULL 
          ELSE v_alternatives_message 
        END,
        'alternatives_data', CASE 
          WHEN v_exact_variant_available THEN NULL 
          ELSE v_alternatives_data 
        END
      );
      
      -- إضافة العنصر للنتيجة
      v_result := v_result || jsonb_build_array(v_item_result);
      
      RAISE NOTICE '✅ تم إضافة المنتج للنتيجة: %', v_item_result;
      
      -- التوقف بعد العثور على أول منتج (يمكن تعديل هذا لاحقاً للبحث عن منتجات متعددة)
      EXIT;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🏁 انتهاء استخراج المنتجات، النتيجة: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;