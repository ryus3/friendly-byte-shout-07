-- إعادة إنشاء دالة استخراج المنتجات بشكل صحيح وكامل
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
  v_size_aliases text[] := ARRAY[
    'small', 'سمول', 'صغير', 's',
    'medium', 'ميديم', 'متوسط', 'm', 'وسط',
    'large', 'لارج', 'كبير', 'l',
    'xl', 'اكس لارج', 'كبير جدا', 'extra large',
    'xxl', 'دبل اكس لارج', 'كبير جداً',
    '2xl', '3xl', '4xl', '5xl'
  ];
  v_size_mapping jsonb := jsonb_build_object(
    'small', 'S', 'سمول', 'S', 'صغير', 'S', 's', 'S',
    'medium', 'M', 'ميديم', 'M', 'متوسط', 'M', 'm', 'M', 'وسط', 'M',
    'large', 'L', 'لارج', 'L', 'كبير', 'L', 'l', 'L',
    'xl', 'XL', 'اكس لارج', 'XL', 'كبير جدا', 'XL', 'extra large', 'XL',
    'xxl', 'XXL', 'دبل اكس لارج', 'XXL', 'كبير جداً', 'XXL',
    '2xl', 'XXL', '3xl', 'XXXL', '4xl', 'XXXXL', '5xl', 'XXXXXL'
  );
  v_selected_product jsonb;
  v_selected_color jsonb;
  v_selected_size jsonb;
  v_final_price numeric := 0;
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
    IF length(v_word) < 3 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المنتجات
    FOR v_product IN
      SELECT p.id, p.name, p.price, p.cost_price
      FROM products p
      WHERE lower(p.name) ILIKE '%' || v_word || '%'
        AND p.is_active = true
      ORDER BY 
        CASE WHEN lower(p.name) = v_word THEN 1
             WHEN lower(p.name) LIKE v_word || '%' THEN 2
             ELSE 3 END,
        length(p.name)
      LIMIT 3
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'price', v_product.price,
        'cost_price', v_product.cost_price,
        'confidence', CASE 
          WHEN lower(v_product.name) = v_word THEN 1.0
          WHEN lower(v_product.name) LIKE v_word || '%' THEN 0.9
          ELSE 0.7
        END
      );
      
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_products) AS item
        WHERE (item->>'id')::uuid = v_product.id
      ) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
      END IF;
    END LOOP;
    
    -- البحث عن الألوان
    FOR v_color IN
      SELECT c.id, c.name
      FROM colors c
      WHERE lower(c.name) ILIKE '%' || v_word || '%'
      ORDER BY 
        CASE WHEN lower(c.name) = v_word THEN 1
             WHEN lower(c.name) LIKE v_word || '%' THEN 2
             ELSE 3 END,
        length(c.name)
      LIMIT 2
    LOOP
      v_temp_color := jsonb_build_object(
        'id', v_color.id,
        'name', v_color.name,
        'confidence', CASE 
          WHEN lower(v_color.name) = v_word THEN 1.0
          WHEN lower(v_color.name) LIKE v_word || '%' THEN 0.9
          ELSE 0.7
        END
      );
      
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_found_colors) AS item
        WHERE (item->>'id')::uuid = v_color.id
      ) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
      END IF;
    END LOOP;
    
    -- البحث عن الأحجام (مع المرادفات)
    IF v_word = ANY(v_size_aliases) THEN
      FOR v_size IN
        SELECT s.id, s.name
        FROM sizes s
        WHERE lower(s.name) = (v_size_mapping->>v_word)::text
           OR lower(s.name) = v_word
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
  
  RAISE NOTICE '🛍️ تم العثور على % منتج، % لون، % حجم', 
    jsonb_array_length(v_found_products), 
    jsonb_array_length(v_found_colors), 
    jsonb_array_length(v_found_sizes);
  
  -- اختيار أفضل منتج
  IF jsonb_array_length(v_found_products) > 0 THEN
    SELECT * INTO v_selected_product
    FROM jsonb_array_elements(v_found_products) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 1;
  END IF;
  
  -- اختيار أفضل لون
  IF jsonb_array_length(v_found_colors) > 0 THEN
    SELECT * INTO v_selected_color
    FROM jsonb_array_elements(v_found_colors) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 1;
  END IF;
  
  -- اختيار أفضل حجم
  IF jsonb_array_length(v_found_sizes) > 0 THEN
    SELECT * INTO v_selected_size
    FROM jsonb_array_elements(v_found_sizes) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 1;
  END IF;
  
  -- إنشاء عنصر المنتج النهائي
  IF v_selected_product IS NOT NULL THEN
    -- البحث عن variant محدد إذا توفر لون وحجم
    IF v_selected_color IS NOT NULL AND v_selected_size IS NOT NULL THEN
      SELECT pv.id, pv.price, pv.cost_price INTO v_variant
      FROM product_variants pv
      WHERE pv.product_id = (v_selected_product->>'id')::uuid
        AND pv.color_id = (v_selected_color->>'id')::uuid
        AND pv.size_id = (v_selected_size->>'id')::uuid
        AND pv.is_active = true
      LIMIT 1;
    END IF;
    
    -- تحديد السعر: من variant أو من المنتج الأساسي
    v_final_price := COALESCE(v_variant.price, (v_selected_product->>'price')::numeric, 0);
    
    v_current_item := jsonb_build_object(
      'product_id', (v_selected_product->>'id')::uuid,
      'product_name', v_selected_product->>'name',
      'variant_id', v_variant.id,
      'color', v_selected_color->>'name',
      'color_id', (v_selected_color->>'id')::uuid,
      'size', v_selected_size->>'name',
      'size_id', (v_selected_size->>'id')::uuid,
      'quantity', 1,
      'unit_price', v_final_price,
      'total_price', v_final_price
    );
  ELSE
    -- إذا لم يتم العثور على منتج، إنشاء عنصر خطأ
    v_current_item := jsonb_build_object(
      'product_id', null,
      'product_name', 'خطأ في استخراج المنتج',
      'variant_id', null,
      'color', null,
      'color_id', null,
      'size', null,
      'size_id', null,
      'quantity', 1,
      'unit_price', 0,
      'total_price', 0
    );
  END IF;
  
  v_final_items := v_final_items || jsonb_build_array(v_current_item);
  
  RAISE NOTICE '✅ تم إنشاء عنصر نهائي: %', v_current_item;
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(jsonb_build_object(
      'product_id', null,
      'product_name', 'خطأ في استخراج المنتج',
      'variant_id', null,
      'color', null,
      'color_id', null,
      'size', null,
      'size_id', null,
      'quantity', 1,
      'unit_price', 0,
      'total_price', 0
    ));
END;
$function$;