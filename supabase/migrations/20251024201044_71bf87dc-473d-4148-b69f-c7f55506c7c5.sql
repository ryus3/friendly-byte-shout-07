-- تحديث دالة extract_product_items_from_text لاستخدام products_cache
-- استخدام الكاش بدلاً من الجداول المنفصلة لتحسين الأداء 3-5x

CREATE OR REPLACE FUNCTION extract_product_items_from_text(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_words TEXT[];
  v_word TEXT;
  v_found_products JSONB := '[]'::jsonb;
  v_found_colors JSONB := '[]'::jsonb;
  v_found_sizes JSONB := '[]'::jsonb;
  v_result JSONB := '[]'::jsonb;
  v_current_item JSONB;
  v_selected_product JSONB;
  v_selected_color JSONB;
  v_selected_size JSONB;
  v_variant RECORD;
  v_quantity INTEGER := 1;
  v_size_mapping JSONB := '{
    "سمول": "S",
    "small": "S",
    "s": "S",
    "صغير": "S",
    "ميديم": "M",
    "medium": "M",
    "m": "M",
    "وسط": "M",
    "متوسط": "M",
    "لارج": "L",
    "large": "L",
    "l": "L",
    "كبير": "L",
    "اكس لارج": "XL",
    "xl": "XL",
    "Xl": "XL",
    "xL": "XL",
    "XL": "XL",
    "اكس": "XL",
    "اكسل": "XL",
    "x": "XL",
    "دبل اكس": "XXL",
    "اكسين": "XXL",
    "اكسين لارج": "XXL",
    "2x": "XXL",
    "2 اكس": "XXL",
    "دبل اكس لارج": "XXL",
    "xxl": "XXL",
    "xXL": "XXL",
    "Xxl": "XXL",
    "XXl": "XXL",
    "XXL": "XXL",
    "ثلاثة اكس": "XXXL",
    "ثلاث اكسات": "XXXL",
    "3x": "XXXL",
    "3 اكس": "XXXL",
    "xxxl": "XXXL",
    "XXXL": "XXXL"
  }'::jsonb;
  v_normalized_size TEXT;
  v_color_item JSONB;
  v_size_item JSONB;
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص (باستخدام cache): %', input_text;
  
  -- تنظيف وتقسيم النص
  v_words := string_to_array(
    regexp_replace(lower(trim(input_text)), '[^\u0600-\u06FFa-z0-9\s]', ' ', 'g'),
    ' '
  );
  
  RAISE NOTICE '📝 الكلمات بعد التقسيم: %', array_to_string(v_words, ', ');

  -- البحث عن المنتجات والألوان والأحجام من الكاش
  FOREACH v_word IN ARRAY v_words
  LOOP
    CONTINUE WHEN length(v_word) < 2;
    
    -- البحث عن منتجات من الكاش
    FOR v_current_item IN
      SELECT jsonb_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'price', p.base_price,
        'colors', p.colors,
        'sizes', p.sizes
      ) AS item
      FROM products_cache p
      WHERE p.normalized_name LIKE '%' || v_word || '%'
      LIMIT 3
    LOOP
      v_found_products := v_found_products || v_current_item.item;
      RAISE NOTICE '✅ منتج محتمل (من cache): % من الكلمة: %', v_current_item.item->>'product_name', v_word;
    END LOOP;

    -- البحث عن ألوان من الكاش (استخراج من JSONB)
    FOR v_current_item IN
      SELECT DISTINCT jsonb_build_object(
        'color_name', color_item->>'name'
      ) AS item
      FROM products_cache p,
           jsonb_array_elements(p.colors) AS color_item
      WHERE lower(color_item->>'name') LIKE '%' || v_word || '%'
      LIMIT 3
    LOOP
      v_found_colors := v_found_colors || v_current_item.item;
      RAISE NOTICE '🎨 لون محتمل (من cache): % من الكلمة: %', v_current_item.item->>'color_name', v_word;
    END LOOP;

    -- البحث عن أحجام من الكاش (مع تطبيع)
    v_normalized_size := v_size_mapping->>v_word;
    
    IF v_normalized_size IS NOT NULL THEN
      RAISE NOTICE '📏 تم العثور على حجم في mapping: "%" -> "%"', v_word, v_normalized_size;
      
      FOR v_current_item IN
        SELECT DISTINCT jsonb_build_object(
          'size_name', size_item->>'name',
          'original_word', v_word
        ) AS item
        FROM products_cache p,
             jsonb_array_elements(p.sizes) AS size_item
        WHERE size_item->>'name' = v_normalized_size
        LIMIT 1
      LOOP
        v_found_sizes := v_found_sizes || v_current_item.item;
        RAISE NOTICE '✅ حجم محتمل (من cache): % (من الكلمة: %)', v_current_item.item->>'size_name', v_word;
      END LOOP;
    ELSE
      -- البحث المباشر إذا لم يكن في mapping
      FOR v_current_item IN
        SELECT DISTINCT jsonb_build_object(
          'size_name', size_item->>'name',
          'original_word', v_word
        ) AS item
        FROM products_cache p,
             jsonb_array_elements(p.sizes) AS size_item
        WHERE lower(size_item->>'name') = v_word
        LIMIT 1
      LOOP
        v_found_sizes := v_found_sizes || v_current_item.item;
        RAISE NOTICE '✅ حجم محتمل (من cache - بحث مباشر): % من الكلمة: %', v_current_item.item->>'size_name', v_word;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE '📊 نتائج البحث - منتجات: %, ألوان: %, أحجام: %', 
    jsonb_array_length(v_found_products),
    jsonb_array_length(v_found_colors), 
    jsonb_array_length(v_found_sizes);

  -- إذا لم نجد أي منتج
  IF jsonb_array_length(v_found_products) = 0 THEN
    RAISE NOTICE '❌ لم يتم العثور على أي منتج في النص';
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ',
        'error', 'no_product_found',
        'message', 'لم أتمكن من العثور على منتج في النص',
        'is_available', false
      )
    );
  END IF;

  -- اختيار المنتج الأول
  v_selected_product := v_found_products->0;
  RAISE NOTICE '🎯 المنتج المختار: %', v_selected_product->>'product_name';

  -- اختيار اللون الأول إن وجد
  IF jsonb_array_length(v_found_colors) > 0 THEN
    v_selected_color := v_found_colors->0;
    RAISE NOTICE '🎨 اللون المختار: %', v_selected_color->>'color_name';
  ELSE
    RAISE NOTICE '⚠️ لم يتم العثور على لون محدد';
  END IF;

  -- اختيار الحجم الأول إن وجد
  IF jsonb_array_length(v_found_sizes) > 0 THEN
    v_selected_size := v_found_sizes->0;
    RAISE NOTICE '📏 الحجم المختار: %', v_selected_size->>'size_name';
  ELSE
    RAISE NOTICE '⚠️ لم يتم العثور على حجم محدد';
  END IF;

  -- البحث عن variant مطابق (من الجداول الأصلية لضمان دقة البيانات)
  RAISE NOTICE '🔍 البحث عن variant: منتج=%, لون=%, حجم=%',
    v_selected_product->>'product_id',
    COALESCE(v_selected_color->>'color_name', 'NULL'),
    COALESCE(v_selected_size->>'size_name', 'NULL');

  SELECT 
    pv.id,
    pv.sku,
    pv.price,
    pv.cost_price,
    COALESCE(inv.quantity, 0) as stock,
    pv.color_id,
    pv.size_id
  INTO v_variant
  FROM product_variants pv
  LEFT JOIN inventory inv ON pv.id = inv.variant_id
  LEFT JOIN colors c ON pv.color_id = c.id
  LEFT JOIN sizes s ON pv.size_id = s.id
  WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
    AND (v_selected_color IS NULL OR lower(c.name) = lower(v_selected_color->>'color_name'))
    AND (v_selected_size IS NULL OR s.name = COALESCE(v_selected_size->>'size_name', s.name))
  LIMIT 1;

  IF v_variant.id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على variant مطابق';
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ',
        'error', 'variant_not_found',
        'message', 'لم أجد هذا المنتج بالمواصفات المحددة',
        'product', v_selected_product->>'product_name',
        'color', COALESCE(v_selected_color->>'color_name', 'غير محدد'),
        'size', COALESCE(v_selected_size->>'size_name', 'غير محدد'),
        'is_available', false
      )
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على variant: SKU=%, السعر=%, المخزون=%', 
    v_variant.sku, v_variant.price, v_variant.stock;

  -- بناء النتيجة النهائية
  v_result := jsonb_build_array(
    jsonb_build_object(
      'product_id', v_selected_product->>'product_id',
      'product_name', v_selected_product->>'product_name',
      'color_id', v_variant.color_id,
      'color_name', COALESCE(v_selected_color->>'color_name', 'افتراضي'),
      'size_id', v_variant.size_id,
      'size_name', COALESCE(v_selected_size->>'size_name', 'افتراضي'),
      'variant_id', v_variant.id,
      'sku', v_variant.sku,
      'quantity', v_quantity,
      'price', v_variant.price,
      'cost_price', v_variant.cost_price,
      'stock', v_variant.stock,
      'is_available', (v_variant.stock >= v_quantity)
    )
  );

  RAISE NOTICE '🎉 النتيجة النهائية: %', v_result;
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '💥 خطأ في extract_product_items_from_text: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ',
        'error', 'exception',
        'message', 'حدث خطأ أثناء استخراج المنتجات: ' || SQLERRM,
        'is_available', false
      )
    );
END;
$$;