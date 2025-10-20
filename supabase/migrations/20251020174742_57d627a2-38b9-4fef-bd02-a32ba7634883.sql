-- ✅ تحسين دالة extract_product_items_from_text (3 خطوات آمنة)
-- الخطوة 1: توسيع مرادفات القياسات (33 مرادف)
-- الخطوة 2: تحسين رسالة الخطأ عند القياس/اللون غير المتوفر
-- الخطوة 3: اختيار تلقائي للون الوحيد

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
  -- ✅ الخطوة 1: توسيع مرادفات القياسات (33 مرادف بدلاً من 9)
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
    "اكس": "XL",
    "اكسل": "XL",
    "x": "XL",
    "Xl": "XL",
    "xL": "XL",
    "XL": "XL",
    
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
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تنظيف وتقسيم النص
  v_words := string_to_array(
    regexp_replace(lower(trim(input_text)), '[^\u0600-\u06FFa-z0-9\s]', ' ', 'g'),
    ' '
  );
  
  RAISE NOTICE '📝 الكلمات بعد التقسيم: %', array_to_string(v_words, ', ');

  -- البحث عن المنتجات والألوان والأحجام
  FOREACH v_word IN ARRAY v_words
  LOOP
    CONTINUE WHEN length(v_word) < 2;
    
    -- البحث عن منتجات
    FOR v_current_item IN
      SELECT jsonb_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'price', p.price
      ) AS item
      FROM products p
      WHERE lower(p.name) LIKE '%' || v_word || '%'
        AND p.is_active = true
      LIMIT 3
    LOOP
      v_found_products := v_found_products || v_current_item.item;
      RAISE NOTICE '✅ منتج محتمل: % من الكلمة: %', v_current_item.item->>'product_name', v_word;
    END LOOP;

    -- البحث عن ألوان
    FOR v_current_item IN
      SELECT jsonb_build_object(
        'color_id', c.id,
        'color_name', c.name
      ) AS item
      FROM colors c
      WHERE lower(c.name) LIKE '%' || v_word || '%'
      LIMIT 3
    LOOP
      v_found_colors := v_found_colors || v_current_item.item;
      RAISE NOTICE '🎨 لون محتمل: % من الكلمة: %', v_current_item.item->>'color_name', v_word;
    END LOOP;

    -- البحث عن أحجام (مع تطبيع)
    v_normalized_size := v_size_mapping->>v_word;
    
    IF v_normalized_size IS NOT NULL THEN
      RAISE NOTICE '📏 تم العثور على حجم في mapping: "%" -> "%"', v_word, v_normalized_size;
      
      FOR v_current_item IN
        SELECT jsonb_build_object(
          'size_id', s.id,
          'size_name', s.name,
          'original_word', v_word
        ) AS item
        FROM sizes s
        WHERE s.name = v_normalized_size
        LIMIT 1
      LOOP
        v_found_sizes := v_found_sizes || v_current_item.item;
        RAISE NOTICE '✅ حجم محتمل: % (من الكلمة: %)', v_current_item.item->>'size_name', v_word;
      END LOOP;
    ELSE
      -- البحث المباشر إذا لم يكن في mapping
      FOR v_current_item IN
        SELECT jsonb_build_object(
          'size_id', s.id,
          'size_name', s.name,
          'original_word', v_word
        ) AS item
        FROM sizes s
        WHERE lower(s.name) = v_word
        LIMIT 1
      LOOP
        v_found_sizes := v_found_sizes || v_current_item.item;
        RAISE NOTICE '✅ حجم محتمل (بحث مباشر): % من الكلمة: %', v_current_item.item->>'size_name', v_word;
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

  -- ✅ الخطوة 3: إذا لم يتم تحديد لون، محاولة اختيار اللون الوحيد المتوفر تلقائياً
  IF v_selected_color IS NULL THEN
    DECLARE
      v_single_color RECORD;
      v_color_count INTEGER;
    BEGIN
      -- عد الألوان المتاحة للمنتج
      SELECT COUNT(DISTINCT pv.color_id)
      INTO v_color_count
      FROM product_variants pv
      LEFT JOIN inventory inv ON pv.id = inv.variant_id
      WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
        AND COALESCE(inv.quantity, 0) > 0;
      
      -- إذا كان هناك لون واحد فقط، اختره تلقائياً
      IF v_color_count = 1 THEN
        SELECT 
          c.id as color_id,
          c.name as color_name
        INTO v_single_color
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        LEFT JOIN inventory inv ON pv.id = inv.variant_id
        WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
          AND COALESCE(inv.quantity, 0) > 0
        LIMIT 1;
        
        IF v_single_color.color_id IS NOT NULL THEN
          v_selected_color := jsonb_build_object(
            'color_id', v_single_color.color_id,
            'color_name', v_single_color.color_name
          );
          RAISE NOTICE '🎨 تم اختيار اللون الوحيد تلقائياً: %', v_single_color.color_name;
        END IF;
      END IF;
    END;
  END IF;

  -- اختيار الحجم الأول إن وجد
  IF jsonb_array_length(v_found_sizes) > 0 THEN
    v_selected_size := v_found_sizes->0;
    RAISE NOTICE '📏 الحجم المختار: %', v_selected_size->>'size_name';
  ELSE
    RAISE NOTICE '⚠️ لم يتم العثور على حجم محدد';
  END IF;

  -- البحث عن variant مطابق
  RAISE NOTICE '🔍 البحث عن variant: منتج=%, لون=%, حجم=%',
    v_selected_product->>'product_id',
    COALESCE(v_selected_color->>'color_id', 'NULL'),
    COALESCE(v_selected_size->>'size_id', 'NULL');

  SELECT 
    pv.id,
    pv.sku,
    pv.price,
    pv.cost_price,
    COALESCE(inv.quantity, 0) as stock
  INTO v_variant
  FROM product_variants pv
  LEFT JOIN inventory inv ON pv.id = inv.variant_id
  WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
    AND (v_selected_color IS NULL OR pv.color_id = (v_selected_color->>'color_id')::uuid)
    AND (v_selected_size IS NULL OR pv.size_id = (v_selected_size->>'size_id')::uuid)
  LIMIT 1;

  IF v_variant.id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على variant مطابق';
    
    -- ✅ الخطوة 2: التحقق هل المشكلة في القياس أم اللون؟
    DECLARE
      v_color_exists BOOLEAN := FALSE;
      v_size_exists BOOLEAN := FALSE;
      v_available_sizes TEXT := '';
      v_available_colors TEXT := '';
    BEGIN
      -- فحص إذا كان اللون موجود
      IF v_selected_color IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 FROM product_variants pv
          WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
            AND pv.color_id = (v_selected_color->>'color_id')::uuid
        ) INTO v_color_exists;
      END IF;
      
      -- فحص إذا كان القياس موجود
      IF v_selected_size IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 FROM product_variants pv
          WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
            AND pv.size_id = (v_selected_size->>'size_id')::uuid
        ) INTO v_size_exists;
      END IF;
      
      -- جلب القياسات المتاحة للمنتج واللون المحددين
      IF v_selected_color IS NOT NULL AND v_selected_size IS NOT NULL THEN
        SELECT string_agg(DISTINCT s.name, ', ' ORDER BY s.name)
        INTO v_available_sizes
        FROM product_variants pv
        JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory inv ON pv.id = inv.variant_id
        WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
          AND pv.color_id = (v_selected_color->>'color_id')::uuid
          AND COALESCE(inv.quantity, 0) > 0;
      END IF;
      
      -- جلب الألوان المتاحة للمنتج
      IF v_selected_color IS NOT NULL AND NOT v_color_exists THEN
        SELECT string_agg(DISTINCT c.name, ', ' ORDER BY c.name)
        INTO v_available_colors
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        LEFT JOIN inventory inv ON pv.id = inv.variant_id
        WHERE pv.product_id = (v_selected_product->>'product_id')::uuid
          AND COALESCE(inv.quantity, 0) > 0;
      END IF;
      
      -- بناء رسالة خطأ مفصلة
      IF v_selected_size IS NOT NULL AND v_available_sizes IS NOT NULL AND v_available_sizes != '' THEN
        -- القياس المطلوب غير متوفر
        RETURN jsonb_build_array(
          jsonb_build_object(
            'product_name', 'خطأ',
            'error', 'size_unavailable',
            'message', format(
              '❌ القياس "%s" غير متوفر للمنتج "%s" باللون "%s"%s%s',
              v_selected_size->>'size_name',
              v_selected_product->>'product_name',
              COALESCE(v_selected_color->>'color_name', 'غير محدد'),
              E'\n\n',
              '✅ القياسات المتاحة: ' || v_available_sizes
            ),
            'product', v_selected_product->>'product_name',
            'color', COALESCE(v_selected_color->>'color_name', 'غير محدد'),
            'size_requested', v_selected_size->>'size_name',
            'available_sizes', v_available_sizes,
            'is_available', false
          )
        );
      ELSIF v_selected_color IS NOT NULL AND v_available_colors IS NOT NULL AND v_available_colors != '' THEN
        -- اللون المطلوب غير متوفر
        RETURN jsonb_build_array(
          jsonb_build_object(
            'product_name', 'خطأ',
            'error', 'color_unavailable',
            'message', format(
              '❌ اللون "%s" غير متوفر للمنتج "%s"%s%s',
              v_selected_color->>'color_name',
              v_selected_product->>'product_name',
              E'\n\n',
              '✅ الألوان المتاحة: ' || v_available_colors
            ),
            'product', v_selected_product->>'product_name',
            'color_requested', v_selected_color->>'color_name',
            'available_colors', v_available_colors,
            'is_available', false
          )
        );
      ELSE
        -- خطأ عام (variant غير موجود بالمواصفات)
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
    END;
  END IF;

  RAISE NOTICE '✅ تم العثور على variant: SKU=%, السعر=%, المخزون=%', 
    v_variant.sku, v_variant.price, v_variant.stock;

  -- بناء النتيجة النهائية
  v_result := jsonb_build_array(
    jsonb_build_object(
      'product_id', v_selected_product->>'product_id',
      'product_name', v_selected_product->>'product_name',
      'color_id', v_selected_color->>'color_id',
      'color_name', COALESCE(v_selected_color->>'color_name', 'افتراضي'),
      'size_id', v_selected_size->>'size_id',
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