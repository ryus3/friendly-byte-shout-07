-- إصلاح دالة استخراج المنتجات من النص
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
  v_delivery_fee numeric := 5000; -- أجور التوصيل الافتراضية
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
  
  -- تطبيع النص: استبدال أسطر جديدة ومسافات متعددة بمسافة واحدة
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_normalized_text := lower(trim(v_normalized_text));
  
  -- تقسيم النص المطبع إلى كلمات
  v_words := string_to_array(v_normalized_text, ' ');
  
  RAISE NOTICE '📝 النص المطبع: %', v_normalized_text;
  RAISE NOTICE '🔤 الكلمات: %', array_to_string(v_words, ', ');
  
  -- البحث عن المنتجات بطريقة محسنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- تخطي الكلمات القصيرة جداً
    IF length(v_word) < 2 THEN
      CONTINUE;
    END IF;
    
    -- البحث المباشر في أسماء المنتجات
    FOR v_product IN 
      SELECT id, name, base_price, cost_price 
      FROM products 
      WHERE lower(name) ILIKE '%' || v_word || '%' 
      AND is_active = true
      ORDER BY 
        CASE 
          WHEN lower(name) = v_word THEN 1
          WHEN lower(name) ILIKE v_word || '%' THEN 2
          WHEN lower(name) ILIKE '%' || v_word || '%' THEN 3
          ELSE 4
        END
      LIMIT 1
    LOOP
      v_temp_product := jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'base_price', COALESCE(v_product.base_price, 0),
        'cost_price', COALESCE(v_product.cost_price, 0)
      );
      
      -- تجنب التكرار
      IF NOT (v_temp_product = ANY(SELECT jsonb_array_elements(v_found_products))) THEN
        v_found_products := v_found_products || jsonb_build_array(v_temp_product);
        RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان بمطابقة حرفية مباشرة فقط
  FOREACH v_word IN ARRAY v_words
  LOOP
    FOR v_color IN 
      SELECT id, name 
      FROM colors 
      WHERE lower(name) = v_word
      ORDER BY name
      LIMIT 1
    LOOP
      v_temp_color := jsonb_build_object(
        'id', v_color.id,
        'name', v_color.name
      );
      
      -- تجنب التكرار
      IF NOT (v_temp_color = ANY(SELECT jsonb_array_elements(v_found_colors))) THEN
        v_found_colors := v_found_colors || jsonb_build_array(v_temp_color);
        RAISE NOTICE '🎨 تم العثور على اللون: % (ID: %)', v_color.name, v_color.id;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الأحجام مع المرادفات المحددة
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث المباشر في الأحجام
    FOR v_size IN 
      SELECT id, name 
      FROM sizes 
      WHERE lower(name) = v_word
      ORDER BY name
      LIMIT 1
    LOOP
      v_temp_size := jsonb_build_object(
        'id', v_size.id,
        'name', v_size.name
      );
      
      IF NOT (v_temp_size = ANY(SELECT jsonb_array_elements(v_found_sizes))) THEN
        v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
        RAISE NOTICE '📏 تم العثور على الحجم: % (ID: %)', v_size.name, v_size.id;
      END IF;
    END LOOP;
    
    -- البحث بالمرادفات
    IF v_word = ANY(v_size_aliases) THEN
      DECLARE
        v_canonical_size text := v_size_mapping->>v_word;
      BEGIN
        FOR v_size IN 
          SELECT id, name 
          FROM sizes 
          WHERE upper(name) = upper(v_canonical_size)
          ORDER BY name
          LIMIT 1
        LOOP
          v_temp_size := jsonb_build_object(
            'id', v_size.id,
            'name', v_size.name
          );
          
          IF NOT (v_temp_size = ANY(SELECT jsonb_array_elements(v_found_sizes))) THEN
            v_found_sizes := v_found_sizes || jsonb_build_array(v_temp_size);
            RAISE NOTICE '📏 تم العثور على الحجم (مرادف): % -> % (ID: %)', v_word, v_size.name, v_size.id;
          END IF;
        END LOOP;
      END;
    END IF;
  END LOOP;
  
  -- بناء عناصر المنتجات
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_found_products)
  LOOP
    DECLARE
      v_product_id uuid := (v_current_item->>'id')::uuid;
      v_color_id uuid := NULL;
      v_size_id uuid := NULL;
      v_variant_price numeric := 0;
      v_total_price numeric := 0;
    BEGIN
      -- أخذ أول لون وحجم إن وجدا
      IF jsonb_array_length(v_found_colors) > 0 THEN
        v_color_id := (v_found_colors->0->>'id')::uuid;
      END IF;
      
      IF jsonb_array_length(v_found_sizes) > 0 THEN
        v_size_id := (v_found_sizes->0->>'id')::uuid;
      END IF;
      
      -- البحث عن سعر المتغير المحدد
      SELECT price INTO v_variant_price
      FROM product_variants 
      WHERE product_id = v_product_id
        AND (color_id = v_color_id OR (color_id IS NULL AND v_color_id IS NULL))
        AND (size_id = v_size_id OR (size_id IS NULL AND v_size_id IS NULL))
      ORDER BY 
        CASE 
          WHEN color_id = v_color_id AND size_id = v_size_id THEN 1
          WHEN color_id = v_color_id THEN 2
          WHEN size_id = v_size_id THEN 3
          ELSE 4
        END
      LIMIT 1;
      
      -- إذا لم نجد متغير، استخدم السعر الأساسي
      IF v_variant_price IS NULL THEN
        v_variant_price := COALESCE((v_current_item->>'base_price')::numeric, 0);
      END IF;
      
      -- حساب السعر الإجمالي = سعر المنتج + أجور التوصيل
      v_total_price := v_variant_price + v_delivery_fee;
      
      v_final_items := v_final_items || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_product_id,
          'product_name', v_current_item->>'name',
          'color_id', v_color_id,
          'color', CASE WHEN v_color_id IS NOT NULL THEN (v_found_colors->0->>'name') ELSE NULL END,
          'size_id', v_size_id,
          'size', CASE WHEN v_size_id IS NOT NULL THEN (v_found_sizes->0->>'name') ELSE NULL END,
          'quantity', v_quantity,
          'unit_price', v_variant_price,
          'delivery_fee', v_delivery_fee,
          'total_price', v_total_price
        )
      );
      
      RAISE NOTICE '🛍️ تم إنشاء عنصر: % - % - % (السعر: % + % = %)', 
        v_current_item->>'name', 
        COALESCE((v_found_colors->0->>'name'), 'بدون لون'), 
        COALESCE((v_found_sizes->0->>'name'), 'بدون حجم'),
        v_variant_price, v_delivery_fee, v_total_price;
    END;
  END LOOP;
  
  RAISE NOTICE '✅ انتهاء الاستخراج. العناصر المكتشفة: %', jsonb_array_length(v_final_items);
  RETURN v_final_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;