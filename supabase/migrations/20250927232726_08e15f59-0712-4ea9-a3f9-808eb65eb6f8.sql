-- إنشاء دالة extract_product_items_from_text لاستعادة وظائف البوت
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
  v_found_products text[] := '{}';
  v_found_colors text[] := '{}';
  v_found_sizes text[] := '{}';
  v_variant record;
  v_inventory record;
  v_price numeric := 0;
  v_alternatives jsonb := '[]';
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE 'بدء استخراج المنتجات من النص: %', input_text;
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(lower(trim(input_text)), ' ');
  
  -- البحث عن المنتجات أولاً
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث في أسماء المنتجات
    FOR v_product IN 
      SELECT id, name, price, cost_price 
      FROM products 
      WHERE lower(name) LIKE '%' || v_word || '%' 
        AND is_active = true
    LOOP
      IF NOT (v_product.name = ANY(v_found_products)) THEN
        v_found_products := array_append(v_found_products, v_product.name);
        RAISE NOTICE 'تم العثور على المنتج: %', v_product.name;
      END IF;
    END LOOP;
  END LOOP;
  
  -- البحث عن الألوان
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث المباشر في الألوان
    FOR v_color IN 
      SELECT id, name 
      FROM colors 
      WHERE lower(name) LIKE '%' || v_word || '%'
    LOOP
      IF NOT (v_color.name = ANY(v_found_colors)) THEN
        v_found_colors := array_append(v_found_colors, v_color.name);
        RAISE NOTICE 'تم العثور على اللون: %', v_color.name;
      END IF;
    END LOOP;
    
    -- البحث في مرادفات الألوان الشائعة
    CASE v_word
      WHEN 'سمائي' THEN 
        v_found_colors := array_append(v_found_colors, 'ازرق');
      WHEN 'أسمر' THEN 
        v_found_colors := array_append(v_found_colors, 'بني');
      WHEN 'فضي' THEN 
        v_found_colors := array_append(v_found_colors, 'رمادي');
      WHEN 'ذهبي' THEN 
        v_found_colors := array_append(v_found_colors, 'أصفر');
      ELSE
        -- لا شيء
    END CASE;
  END LOOP;
  
  -- البحث عن الأحجام
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث المباشر في الأحجام
    FOR v_size IN 
      SELECT id, name 
      FROM sizes 
      WHERE lower(name) LIKE '%' || v_word || '%'
    LOOP
      IF NOT (v_size.name = ANY(v_found_sizes)) THEN
        v_found_sizes := array_append(v_found_sizes, v_size.name);
        RAISE NOTICE 'تم العثور على الحجم: %', v_size.name;
      END IF;
    END LOOP;
    
    -- البحث في مرادفات الأحجام الشائعة
    CASE v_word
      WHEN 'ميديم' THEN 
        v_found_sizes := array_append(v_found_sizes, 'M');
      WHEN 'لارج' THEN 
        v_found_sizes := array_append(v_found_sizes, 'L');
      WHEN 'اكسترا' THEN 
        v_found_sizes := array_append(v_found_sizes, 'XL');
      WHEN 'سمول' THEN 
        v_found_sizes := array_append(v_found_sizes, 'S');
      WHEN 'صغير' THEN 
        v_found_sizes := array_append(v_found_sizes, 'S');
      WHEN 'كبير' THEN 
        v_found_sizes := array_append(v_found_sizes, 'L');
      WHEN 'وسط' THEN 
        v_found_sizes := array_append(v_found_sizes, 'M');
      ELSE
        -- لا شيء
    END CASE;
  END LOOP;
  
  -- البحث عن الكمية
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word ~ '^[0-9]+$' AND v_word::integer > 0 AND v_word::integer <= 100 THEN
      v_quantity := v_word::integer;
      RAISE NOTICE 'تم العثور على الكمية: %', v_quantity;
      EXIT;
    END IF;
  END LOOP;
  
  -- إنشاء عناصر المنتجات
  FOR v_product IN 
    SELECT p.id, p.name, p.price, p.cost_price 
    FROM products p 
    WHERE p.name = ANY(v_found_products) 
      AND p.is_active = true
  LOOP
    -- البحث عن المتغيرات المتاحة
    FOR v_variant IN
      SELECT pv.id, pv.product_id, c.name as color_name, s.name as size_name, 
             pv.price, pv.cost_price, pv.sku
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_product.id
        AND pv.is_active = true
        AND (array_length(v_found_colors, 1) IS NULL OR c.name = ANY(v_found_colors))
        AND (array_length(v_found_sizes, 1) IS NULL OR s.name = ANY(v_found_sizes))
    LOOP
      -- فحص المخزون
      SELECT i.quantity, i.reserved_quantity, i.min_stock
      INTO v_inventory
      FROM inventory i
      WHERE i.variant_id = v_variant.id;
      
      v_price := COALESCE(v_variant.price, v_product.price, 0);
      
      -- إنشاء عنصر المنتج
      v_current_item := jsonb_build_object(
        'product_id', v_variant.product_id,
        'variant_id', v_variant.id,
        'product_name', v_product.name,
        'color', v_variant.color_name,
        'size', v_variant.size_name,
        'quantity', v_quantity,
        'price', v_price,
        'total_price', v_price * v_quantity,
        'sku', v_variant.sku,
        'available_quantity', COALESCE(v_inventory.quantity, 0),
        'reserved_quantity', COALESCE(v_inventory.reserved_quantity, 0),
        'is_available', COALESCE(v_inventory.quantity, 0) >= v_quantity,
        'stock_status', CASE 
          WHEN COALESCE(v_inventory.quantity, 0) = 0 THEN 'out_of_stock'
          WHEN COALESCE(v_inventory.quantity, 0) < v_quantity THEN 'insufficient_stock'
          ELSE 'available'
        END
      );
      
      v_result := v_result || v_current_item;
      RAISE NOTICE 'تم إضافة عنصر: % - % - %', v_product.name, v_variant.color_name, v_variant.size_name;
    END LOOP;
  END LOOP;
  
  -- إذا لم يتم العثور على منتجات محددة، إنشاء قائمة بدائل
  IF jsonb_array_length(v_result) = 0 AND array_length(v_found_products, 1) > 0 THEN
    FOR v_product IN 
      SELECT p.id, p.name, p.price 
      FROM products p 
      WHERE p.name = ANY(v_found_products) 
        AND p.is_active = true
    LOOP
      -- جمع البدائل المتاحة
      FOR v_variant IN
        SELECT pv.id, c.name as color_name, s.name as size_name, 
               pv.price, i.quantity
        FROM product_variants pv
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON pv.id = i.variant_id
        WHERE pv.product_id = v_product.id
          AND pv.is_active = true
          AND COALESCE(i.quantity, 0) > 0
        ORDER BY c.name, s.name
      LOOP
        v_alternatives := v_alternatives || jsonb_build_object(
          'color', v_variant.color_name,
          'size', v_variant.size_name,
          'available_quantity', COALESCE(v_variant.quantity, 0)
        );
      END LOOP;
      
      -- إنشاء عنصر بديل
      v_current_item := jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'requested_colors', v_found_colors,
        'requested_sizes', v_found_sizes,
        'quantity', v_quantity,
        'is_available', false,
        'error_message', 'المنتج غير متوفر بالمواصفات المطلوبة',
        'alternatives', v_alternatives
      );
      
      v_result := v_result || v_current_item;
    END LOOP;
  END IF;
  
  RAISE NOTICE 'انتهاء الاستخراج: تم العثور على % عنصر', jsonb_array_length(v_result);
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN '[]'::jsonb;
END;
$function$;