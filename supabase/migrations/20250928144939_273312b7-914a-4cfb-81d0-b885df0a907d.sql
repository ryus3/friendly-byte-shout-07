-- تحديث دالة extract_product_items_from_text لتفهم الألوان والأحجام
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
  v_normalized_text text;
  v_variant record;
  v_item_result jsonb;
  v_variant_price numeric := 20000;
  v_found_color text := NULL;
  v_found_size text := NULL;
  v_color_mapping jsonb;
  v_size_mapping jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- جدول مطابقة الألوان العامية
  v_color_mapping := '{
    "ازرق": "ازرق",
    "أزرق": "ازرق", 
    "ابيض": "ابيض",
    "أبيض": "ابيض",
    "اسود": "اسود",
    "أسود": "اسود",
    "احمر": "احمر",
    "أحمر": "احمر",
    "اخضر": "اخضر",
    "أخضر": "اخضر",
    "اصفر": "اصفر",
    "أصفر": "اصفر",
    "بني": "بني",
    "رمادي": "رمادي",
    "وردي": "وردي",
    "بنفسجي": "بنفسجي"
  }'::jsonb;

  -- جدول مطابقة الأحجام العامية
  v_size_mapping := '{
    "لارج": "L",
    "كبير": "L",
    "لارچ": "L",
    "ميديم": "M",
    "متوسط": "M",
    "وسط": "M",
    "ميديوم": "M",
    "سمول": "S",
    "صغير": "S",
    "سمال": "S",
    "اكس لارج": "XL",
    "اكسترا لارج": "XL",
    "xl": "XL",
    "xxl": "XXL",
    "اكس اكس لارج": "XXL"
  }'::jsonb;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن الألوان في النص
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    IF v_color_mapping ? v_word THEN
      v_found_color := v_color_mapping->>v_word;
      RAISE NOTICE '🎨 تم العثور على اللون: % -> %', v_word, v_found_color;
      EXIT;
    END IF;
  END LOOP;
  
  -- البحث عن الأحجام في النص
  FOR v_word IN SELECT unnest(v_words)
  LOOP
    IF v_size_mapping ? v_word THEN
      v_found_size := v_size_mapping->>v_word;
      RAISE NOTICE '📏 تم العثور على الحجم: % -> %', v_word, v_found_size;
      EXIT;
    END IF;
  END LOOP;
  
  -- البحث عن المنتج في النص
  FOR v_product IN
    SELECT p.id, p.name, p.base_price
    FROM products p
    WHERE p.is_active = true
    ORDER BY length(p.name) DESC
  LOOP
    IF lower(v_normalized_text) LIKE '%' || lower(v_product.name) || '%' THEN
      RAISE NOTICE '🎯 تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      
      -- 1. أولاً: البحث عن المتغير بناءً على اللون والحجم المحددين
      IF v_found_color IS NOT NULL AND v_found_size IS NOT NULL THEN
        SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
               COALESCE(pv.price, v_product.base_price, 20000) as variant_price
        INTO v_variant
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
          AND LOWER(c.name) LIKE '%' || LOWER(v_found_color) || '%'
          AND UPPER(s.name) = UPPER(v_found_size)
          AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0)
        ORDER BY pv.created_at
        LIMIT 1;
        
        IF v_variant.id IS NOT NULL THEN
          RAISE NOTICE '✅ تم العثور على المتغير بناءً على اللون والحجم: % %', v_found_color, v_found_size;
        END IF;
      END IF;
      
      -- 2. ثانياً: البحث بناءً على اللون فقط
      IF v_variant.id IS NULL AND v_found_color IS NOT NULL THEN
        SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
               COALESCE(pv.price, v_product.base_price, 20000) as variant_price
        INTO v_variant
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
          AND LOWER(c.name) LIKE '%' || LOWER(v_found_color) || '%'
          AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0)
        ORDER BY pv.created_at
        LIMIT 1;
        
        IF v_variant.id IS NOT NULL THEN
          RAISE NOTICE '✅ تم العثور على المتغير بناءً على اللون: %', v_found_color;
        END IF;
      END IF;
      
      -- 3. ثالثاً: البحث بناءً على الحجم فقط
      IF v_variant.id IS NULL AND v_found_size IS NOT NULL THEN
        SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
               COALESCE(pv.price, v_product.base_price, 20000) as variant_price
        INTO v_variant
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
          AND UPPER(s.name) = UPPER(v_found_size)
          AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0)
        ORDER BY pv.created_at
        LIMIT 1;
        
        IF v_variant.id IS NOT NULL THEN
          RAISE NOTICE '✅ تم العثور على المتغير بناءً على الحجم: %', v_found_size;
        END IF;
      END IF;
      
      -- 4. رابعاً: البحث عن أول متغير متوفر (الطريقة الافتراضية)
      IF v_variant.id IS NULL THEN
        SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
               COALESCE(pv.price, v_product.base_price, 20000) as variant_price
        INTO v_variant
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
          AND COALESCE(i.quantity, 0) > COALESCE(i.reserved_quantity, 0)
        ORDER BY pv.created_at
        LIMIT 1;
        
        IF v_variant.id IS NOT NULL THEN
          RAISE NOTICE '✅ تم العثور على أول متغير متوفر (افتراضي)';
        END IF;
      END IF;
      
      -- 5. خامساً: إذا لم نجد متغير متوفر، خذ أي متغير نشط
      IF v_variant.id IS NULL THEN
        SELECT pv.id, pv.barcode, c.name as color_name, s.name as size_name,
               COALESCE(pv.price, v_product.base_price, 20000) as variant_price
        INTO v_variant
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
        ORDER BY pv.created_at
        LIMIT 1;
        
        IF v_variant.id IS NOT NULL THEN
          RAISE NOTICE '⚠️ تم العثور على متغير نشط (قد يكون غير متوفر)';
        END IF;
      END IF;
      
      -- إنشاء عنصر المنتج
      IF v_variant.id IS NOT NULL THEN
        v_item_result := jsonb_build_object(
          'product_id', v_product.id,
          'variant_id', v_variant.id,
          'product_name', v_product.name,
          'color', COALESCE(v_variant.color_name, 'افتراضي'),
          'size', COALESCE(v_variant.size_name, 'افتراضي'),
          'quantity', 1,
          'unit_price', v_variant.variant_price,
          'total_price', v_variant.variant_price,
          'barcode', v_variant.barcode
        );
        
        v_result := v_result || jsonb_build_array(v_item_result);
        RAISE NOTICE '✅ تم إضافة المنتج: %', v_item_result;
      ELSE
        RAISE NOTICE '❌ لم يتم العثور على متغيرات للمنتج: %', v_product.name;
      END IF;
      
      EXIT; -- خروج بعد العثور على أول منتج
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ انتهاء الاستخراج، النتيجة: %', v_result;
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;