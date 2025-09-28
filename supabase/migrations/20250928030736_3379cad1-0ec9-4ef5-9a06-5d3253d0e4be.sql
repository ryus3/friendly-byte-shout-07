-- حذف الدالة الخاطئة نهائياً
DROP FUNCTION IF EXISTS public.extract_product_items_with_availability_check(text);

-- إصلاح دالة extract_product_items_from_text لحذف أجور التوصيل المكررة
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
  v_quantity integer := 1;
  v_current_item jsonb;
  v_found_products jsonb := '[]';
  v_found_colors jsonb := '[]';
  v_found_sizes jsonb := '[]';
  v_variant record;
  v_price numeric := 0;
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
    ELSE
      -- البحث المباشر في الأحجام
      FOR v_size IN
        SELECT s.id, s.name
        FROM sizes s
        WHERE lower(s.name) ILIKE '%' || v_word || '%'
        ORDER BY 
          CASE WHEN lower(s.name) = v_word THEN 1
               WHEN lower(s.name) LIKE v_word || '%' THEN 2
               ELSE 3 END,
          length(s.name)
        LIMIT 2
      LOOP
        v_temp_size := jsonb_build_object(
          'id', v_size.id,
          'name', v_size.name,
          'confidence', CASE 
            WHEN lower(v_size.name) = v_word THEN 1.0
            WHEN lower(v_size.name) LIKE v_word || '%' THEN 0.9
            ELSE 0.7
          END
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
  
  -- إنشاء عناصر الطلب من أفضل التطابقات
  FOR v_product IN
    SELECT 
      (item->>'id')::uuid as id,
      item->>'name' as name,
      (item->>'price')::numeric as price,
      (item->>'cost_price')::numeric as cost_price,
      (item->>'confidence')::numeric as confidence
    FROM jsonb_array_elements(v_found_products) AS item
    ORDER BY (item->>'confidence')::numeric DESC
    LIMIT 3
  LOOP
    -- محاولة العثور على لون مطابق
    v_color := NULL;
    FOR v_color IN
      SELECT 
        (item->>'id')::uuid as id,
        item->>'name' as name,
        (item->>'confidence')::numeric as confidence
      FROM jsonb_array_elements(v_found_colors) AS item
      ORDER BY (item->>'confidence')::numeric DESC
      LIMIT 1
    LOOP
      EXIT; -- أخذ أول (أفضل) نتيجة
    END LOOP;
    
    -- محاولة العثور على حجم مطابق
    v_size := NULL;
    FOR v_size IN
      SELECT 
        (item->>'id')::uuid as id,
        item->>'name' as name,
        (item->>'confidence')::numeric as confidence
      FROM jsonb_array_elements(v_found_sizes) AS item
      ORDER BY (item->>'confidence')::numeric DESC
      LIMIT 1
    LOOP
      EXIT; -- أخذ أول (أفضل) نتيجة
    END LOOP;
    
    -- البحث عن variant مطابق
    v_variant := NULL;
    IF v_color.id IS NOT NULL AND v_size.id IS NOT NULL THEN
      SELECT pv.id, pv.price, pv.cost_price
      INTO v_variant
      FROM product_variants pv
      WHERE pv.product_id = v_product.id
        AND pv.color_id = v_color.id
        AND pv.size_id = v_size.id
        AND pv.is_active = true
      LIMIT 1;
    END IF;
    
    -- تحديد السعر (من المتغير إن وجد، وإلا من المنتج)
    v_price := COALESCE(v_variant.price, v_product.price, 0);
    
    -- إنشاء عنصر الطلب - تم إزالة أجور التوصيل من total_price
    v_current_item := jsonb_build_object(
      'product_id', v_product.id,
      'variant_id', v_variant.id,
      'product_name', v_product.name,
      'color', v_color.name,
      'size', v_size.name,
      'color_id', v_color.id,
      'size_id', v_size.id,
      'quantity', v_quantity,
      'unit_price', v_price,
      'total_price', v_price * v_quantity -- فقط سعر المنتج بدون أجور التوصيل
    );
    
    v_final_items := v_final_items || jsonb_build_array(v_current_item);
    
    RAISE NOTICE '✅ تم إنشاء عنصر: % - %، اللون: %، الحجم: %، السعر: %', 
      v_product.name, v_variant.id, v_color.name, v_size.name, v_price;
    
    -- للحصول على عنصر واحد فقط (أفضل تطابق)
    EXIT;
  END LOOP;
  
  -- إذا لم نجد أي منتجات، أنشئ عنصر افتراضي
  IF jsonb_array_length(v_final_items) = 0 THEN
    v_current_item := jsonb_build_object(
      'product_id', null,
      'variant_id', null,
      'product_name', 'منتج غير محدد',
      'color', null,
      'size', null,
      'color_id', null,
      'size_id', null,
      'quantity', 1,
      'unit_price', 0,
      'total_price', 0
    );
    v_final_items := v_final_items || jsonb_build_array(v_current_item);
  END IF;
  
  RAISE NOTICE '🎯 النتيجة النهائية: %', v_final_items;
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    -- إرجاع عنصر افتراضي في حالة الخطأ
    RETURN jsonb_build_array(jsonb_build_object(
      'product_id', null,
      'variant_id', null,
      'product_name', 'خطأ في استخراج المنتج',
      'color', null,
      'size', null,
      'color_id', null,
      'size_id', null,
      'quantity', 1,
      'unit_price', 0,
      'total_price', 0
    ));
END;
$function$;