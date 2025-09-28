-- إصلاح دالة استخراج المنتجات - تغيير p.price إلى p.base_price
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
  v_color record;
  v_size record;
  v_current_item jsonb;
  v_found_products jsonb := '[]';
  v_found_colors jsonb := '[]';
  v_found_sizes jsonb := '[]';
  v_variant record;
  v_normalized_text text;
  v_temp_product jsonb;
  v_temp_color jsonb;
  v_temp_size jsonb;
  v_final_items jsonb := '[]';
  
  -- مرادفات الأحجام الشاملة
  v_size_mapping jsonb := jsonb_build_object(
    'سمول', 'S', 'صغير', 'S', 's', 'S', 'S', 'S',
    'ميديم', 'M', 'متوسط', 'M', 'وسط', 'M', 'm', 'M', 'M', 'M',
    'لارج', 'L', 'كبير', 'L', 'l', 'L', 'L', 'L',
    'xl', 'XL', 'XL', 'XL', 'Xl', 'XL', 'xL', 'XL', 'اكس', 'XL', 'اكس لارج', 'XL', 'اكسلارج', 'XL',
    'xxl', 'XXL', 'XXL', 'XXL', 'Xxl', 'XXL', 'xXl', 'XXL', 'xxL', 'XXL', 'xXL', 'XXL', 'XxL', 'XXL', 
    'اكسين', 'XXL', 'اكسين لارج', 'XXL', 'اكسينلارج', 'XXL',
    'xxxl', 'XXXL', 'XXXL', 'XXXL', 'Xxxl', 'XXXL', 'xXxl', 'XXXL', 'XxxL', 'XXXL', 
    'ثلاث اكسات', 'XXXL', '3 اكس', 'XXXL', '3 اكسات', 'XXXL'
  );
  
  v_selected_product jsonb;
  v_selected_color jsonb;
  v_selected_size jsonb;
  v_final_price numeric := 0;
  v_available_colors text[] := '{}';
  v_available_sizes text[] := '{}';
  v_stock_info text := '';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن المنتجات والألوان والأحجام
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام
    IF length(v_word) < 2 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المنتجات مع مرادفات الأسماء
    FOR v_product IN
      SELECT p.id, p.name, p.base_price, p.cost_price
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
          WHEN lower(replace(p.name, 'ة', 'ه')) = v_word THEN 3
          WHEN lower(replace(p.name, 'ه', 'ة')) = v_word THEN 4
          ELSE 5 
        END,
        length(p.name)
      LIMIT 3
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'base_price', v_product.base_price,
        'cost_price', v_product.cost_price,
        'confidence', CASE 
          WHEN lower(v_product.name) = v_word THEN 1.0
          WHEN lower(v_product.name) LIKE v_word || '%' THEN 0.9
          ELSE 0.8
        END
      );
      
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_products) AS item
        WHERE (item->>'id')::uuid = v_product.id
      ) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
      END IF;
    END LOOP;
    
    -- البحث عن الألوان (بدون مرادفات - الأسماء الموجودة فقط)
    FOR v_color IN
      SELECT c.id, c.name
      FROM colors c
      WHERE lower(c.name) = v_word
        OR lower(c.name) LIKE v_word || '%'
      ORDER BY 
        CASE WHEN lower(c.name) = v_word THEN 1 ELSE 2 END,
        length(c.name)
      LIMIT 2
    LOOP
      v_temp_color := jsonb_build_object(
        'id', v_color.id,
        'name', v_color.name,
        'confidence', CASE 
          WHEN lower(v_color.name) = v_word THEN 1.0
          ELSE 0.9
        END
      );
      
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_colors) AS item
        WHERE (item->>'id')::uuid = v_color.id
      ) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
      END IF;
    END LOOP;
    
    -- البحث عن الأحجام مع المرادفات الشاملة
    IF v_size_mapping ? v_word THEN
      FOR v_size IN
        SELECT s.id, s.name
        FROM sizes s
        WHERE s.name = (v_size_mapping->>v_word)::text
        LIMIT 1
      LOOP
        v_temp_size := jsonb_build_object(
          'id', v_size.id,
          'name', v_size.name,
          'confidence', 1.0
        );
        
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_found_sizes) AS item
          WHERE (item->>'id')::uuid = v_size.id
        ) THEN
          v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  
  RAISE NOTICE '🔍 العثور على % منتج، % لون، % حجم', 
    jsonb_array_length(v_found_products), 
    jsonb_array_length(v_found_colors), 
    jsonb_array_length(v_found_sizes);
  
  -- اختيار أفضل منتج ولون وحجم
  IF jsonb_array_length(v_found_products) > 0 THEN
    SELECT * INTO v_selected_product 
    FROM jsonb_array_elements(v_found_products) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 1;
  END IF;
  
  IF jsonb_array_length(v_found_colors) > 0 THEN
    SELECT * INTO v_selected_color 
    FROM jsonb_array_elements(v_found_colors) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 1;
  END IF;
  
  IF jsonb_array_length(v_found_sizes) > 0 THEN
    SELECT * INTO v_selected_size 
    FROM jsonb_array_elements(v_found_sizes) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 1;
  END IF;
  
  -- إذا تم العثور على منتج
  IF v_selected_product IS NOT NULL THEN
    RAISE NOTICE '✅ تم اختيار المنتج: %', v_selected_product->>'name';
    
    -- البحث عن variant محدد إذا توفر لون وحجم
    IF v_selected_color IS NOT NULL AND v_selected_size IS NOT NULL THEN
      SELECT pv.*, i.quantity as stock_quantity
      INTO v_variant
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = (v_selected_product->>'id')::uuid
        AND pv.color_id = (v_selected_color->>'id')::uuid
        AND pv.size_id = (v_selected_size->>'id')::uuid
      LIMIT 1;
      
      IF v_variant.id IS NOT NULL THEN
        -- تم العثور على variant محدد
        v_final_price := COALESCE(v_variant.price, (v_selected_product->>'base_price')::numeric, 0);
        
        -- فحص التوفر
        IF COALESCE(v_variant.stock_quantity, 0) > 0 THEN
          v_stock_info := '✅ متوفر في المخزون';
        ELSE
          v_stock_info := '❌ غير متوفر حالياً';
        END IF;
        
        v_final_items := v_final_items || jsonb_build_array(
          jsonb_build_object(
            'product_id', v_variant.product_id,
            'variant_id', v_variant.id,
            'product_name', v_selected_product->>'name',
            'color_name', v_selected_color->>'name',
            'size_name', v_selected_size->>'name',
            'quantity', 1,
            'unit_price', v_final_price,
            'total_price', v_final_price,
            'stock_status', v_stock_info,
            'available_stock', COALESCE(v_variant.stock_quantity, 0)
          )
        );
        
        RAISE NOTICE '✅ تم إنشاء عنصر كامل: % % % - السعر: %', 
          v_selected_product->>'name', v_selected_color->>'name', v_selected_size->>'name', v_final_price;
      ELSE
        -- لم يتم العثور على variant محدد، البحث عن البدائل المتوفرة
        RAISE NOTICE '⚠️ لم يتم العثور على variant محدد، البحث عن البدائل...';
        
        -- جمع الألوان المتوفرة للمنتج
        SELECT array_agg(DISTINCT c.name) INTO v_available_colors
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = (v_selected_product->>'id')::uuid
          AND COALESCE(i.quantity, 0) > 0;
        
        -- جمع الأحجام المتوفرة للمنتج
        SELECT array_agg(DISTINCT s.name) INTO v_available_sizes
        FROM product_variants pv
        JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = (v_selected_product->>'id')::uuid
          AND COALESCE(i.quantity, 0) > 0;
        
        v_final_items := v_final_items || jsonb_build_array(
          jsonb_build_object(
            'product_id', (v_selected_product->>'id')::uuid,
            'variant_id', null,
            'product_name', v_selected_product->>'name',
            'color_name', COALESCE(v_selected_color->>'name', 'غير محدد'),
            'size_name', COALESCE(v_selected_size->>'name', 'غير محدد'),
            'quantity', 1,
            'unit_price', (v_selected_product->>'base_price')::numeric,
            'total_price', (v_selected_product->>'base_price')::numeric,
            'stock_status', '❌ المواصفات المطلوبة غير متوفرة',
            'available_colors', COALESCE(v_available_colors, ARRAY[]::text[]),
            'available_sizes', COALESCE(v_available_sizes, ARRAY[]::text[]),
            'alternatives_message', 
              CASE 
                WHEN array_length(v_available_colors, 1) > 0 AND array_length(v_available_sizes, 1) > 0 THEN
                  '✅ الألوان المتوفرة: ' || array_to_string(v_available_colors, ', ') || chr(10) ||
                  '✅ الأحجام المتوفرة: ' || array_to_string(v_available_sizes, ', ')
                WHEN array_length(v_available_colors, 1) > 0 THEN
                  '✅ الألوان المتوفرة: ' || array_to_string(v_available_colors, ', ')
                WHEN array_length(v_available_sizes, 1) > 0 THEN
                  '✅ الأحجام المتوفرة: ' || array_to_string(v_available_sizes, ', ')
                ELSE '❌ المنتج غير متوفر حالياً'
              END
          )
        );
      END IF;
    ELSE
      -- منتج فقط بدون لون أو حجم محدد
      RAISE NOTICE '⚠️ تم العثور على منتج فقط بدون لون أو حجم محدد';
      
      v_final_price := (v_selected_product->>'base_price')::numeric;
      
      -- جمع الألوان والأحجام المتوفرة
      SELECT array_agg(DISTINCT c.name) INTO v_available_colors
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = (v_selected_product->>'id')::uuid
        AND COALESCE(i.quantity, 0) > 0;
      
      SELECT array_agg(DISTINCT s.name) INTO v_available_sizes
      FROM product_variants pv
      JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = (v_selected_product->>'id')::uuid
        AND COALESCE(i.quantity, 0) > 0;
      
      v_final_items := v_final_items || jsonb_build_array(
        jsonb_build_object(
          'product_id', (v_selected_product->>'id')::uuid,
          'variant_id', null,
          'product_name', v_selected_product->>'name',
          'color_name', COALESCE(v_selected_color->>'name', 'يرجى تحديد اللون'),
          'size_name', COALESCE(v_selected_size->>'name', 'يرجى تحديد الحجم'),
          'quantity', 1,
          'unit_price', v_final_price,
          'total_price', v_final_price,
          'stock_status', '⚠️ يرجى تحديد اللون والحجم',
          'available_colors', COALESCE(v_available_colors, ARRAY[]::text[]),
          'available_sizes', COALESCE(v_available_sizes, ARRAY[]::text[]),
          'selection_needed', true,
          'alternatives_message', 
            '🎨 الألوان المتوفرة: ' || COALESCE(array_to_string(v_available_colors, ', '), 'لا توجد') || chr(10) ||
            '📏 الأحجام المتوفرة: ' || COALESCE(array_to_string(v_available_sizes, ', '), 'لا توجد')
        )
      );
    END IF;
  ELSE
    -- لم يتم العثور على أي منتج
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
    
    v_final_items := v_final_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', null,
        'variant_id', null,
        'product_name', 'منتج غير معروف',
        'color_name', 'غير محدد',
        'size_name', 'غير محدد',
        'quantity', 1,
        'unit_price', 0,
        'total_price', 0,
        'stock_status', '❌ لم يتم التعرف على المنتج',
        'error_message', 'لم يتم العثور على منتج مطابق في قاعدة البيانات'
      )
    );
  END IF;
  
  RAISE NOTICE '✅ انتهاء استخراج المنتجات: % عنصر', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_id', null,
        'variant_id', null,
        'product_name', 'خطأ في المعالجة',
        'error_message', SQLERRM,
        'quantity', 1,
        'unit_price', 0,
        'total_price', 0
      )
    );
END;
$function$;