-- تحديث دالة استخراج المنتجات لتحسين رسالة الكمية غير المتوفرة
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_words text[];
  v_word text;
  v_product_items jsonb := '[]';
  v_quantity integer := 1;
  v_found_product record;
  v_found_color record;
  v_found_size record;
  v_variant record;
  v_alternatives text := '';
  v_normalized_text text;
  v_color_requested boolean := false;
  v_size_requested boolean := false;
  v_smart_alternatives text := '';
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن الكمية - فقط الأرقام القصيرة (1-3 خانات) لتجنب أرقام الهاتف
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word ~ '^[0-9]{1,3}$' AND v_word::integer BETWEEN 1 AND 100 THEN
      v_quantity := v_word::integer;
      RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
    END IF;
  END LOOP;
  
  -- البحث عن المنتج
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF length(v_word) < 2 THEN CONTINUE; END IF;
    
    SELECT p.id, p.name INTO v_found_product
    FROM products p 
    WHERE p.is_active = true 
      AND (lower(p.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(p.name) || '%')
    ORDER BY 
      CASE WHEN lower(p.name) = v_word THEN 1
           WHEN lower(p.name) LIKE v_word || '%' THEN 2
           ELSE 3 END
    LIMIT 1;
    
    IF v_found_product.id IS NOT NULL THEN
      RAISE NOTICE '🎯 تم العثور على المنتج: %', v_found_product.name;
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم يتم العثور على منتج
  IF v_found_product.id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على منتج';
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'غير محدد',
        'color', 'افتراضي',
        'size', 'افتراضي',
        'quantity', v_quantity,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب'
      )
    );
  END IF;
  
  -- البحث عن اللون وتحديد ما إذا كان مطلوباً
  FOREACH v_word IN ARRAY v_words
  LOOP
    SELECT c.id, c.name INTO v_found_color
    FROM colors c 
    WHERE lower(c.name) LIKE '%' || v_word || '%' 
       OR v_word LIKE '%' || lower(c.name) || '%'
    LIMIT 1;
    
    IF v_found_color.id IS NOT NULL THEN
      v_color_requested := true;
      RAISE NOTICE '🎨 تم العثور على اللون: %', v_found_color.name;
      EXIT;
    ELSE
      IF v_word IN ('احمر', 'اخضر', 'اصفر', 'برتقالي', 'بنفسجي', 'وردي', 'رمادي', 'بني') THEN
        v_color_requested := true;
        v_found_color.name := v_word;
        RAISE NOTICE '🎨 تم طلب لون غير متوفر: %', v_word;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- البحث عن الحجم مع تطبيع أسماء الأحجام وتحديد ما إذا كان مطلوباً
  FOREACH v_word IN ARRAY v_words
  LOOP
    SELECT s.id, s.name INTO v_found_size
    FROM sizes s 
    WHERE lower(s.name) = v_word
       OR (v_word = 'ميديم' AND lower(s.name) = 'm')
       OR (v_word = 'لارج' AND lower(s.name) = 'l')
       OR (v_word = 'اكس' AND lower(s.name) = 'xl')
       OR (v_word = 'سمول' AND lower(s.name) = 's')
       OR lower(s.name) LIKE '%' || v_word || '%'
    LIMIT 1;
    
    IF v_found_size.id IS NOT NULL THEN
      v_size_requested := true;
      RAISE NOTICE '📏 تم العثور على الحجم: %', v_found_size.name;
      EXIT;
    ELSE
      IF v_word IN ('ميديم', 'لارج', 'سمول', 'اكس', 'دبل', 'كبير', 'صغير', 'وسط', 'xxxl', 'xxl') THEN
        v_size_requested := true;
        v_found_size.name := v_word;
        RAISE NOTICE '📏 تم طلب حجم غير متوفر: %', v_word;
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- البحث عن المتغير المحدد
  IF (NOT v_color_requested OR v_found_color.id IS NOT NULL) 
     AND (NOT v_size_requested OR v_found_size.id IS NOT NULL) THEN
    
    SELECT pv.id, pv.price, COALESCE(i.quantity - i.reserved_quantity, 0) as available_stock
    INTO v_variant
    FROM product_variants pv
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_found_product.id
      AND (v_found_color.id IS NULL OR pv.color_id = v_found_color.id)
      AND (v_found_size.id IS NULL OR pv.size_id = v_found_size.id)
    ORDER BY COALESCE(i.quantity - i.reserved_quantity, 0) DESC
    LIMIT 1;
    
    IF v_variant.id IS NOT NULL AND v_variant.available_stock >= v_quantity THEN
      RAISE NOTICE '✅ المنتج متوفر';
      RETURN jsonb_build_array(
        jsonb_build_object(
          'product_name', v_found_product.name,
          'color', COALESCE(v_found_color.name, 'افتراضي'),
          'size', COALESCE(v_found_size.name, 'افتراضي'),
          'quantity', v_quantity,
          'price', COALESCE(v_variant.price, 15000),
          'total_price', COALESCE(v_variant.price, 15000) * v_quantity,
          'is_available', true,
          'alternatives_message', ''
        )
      );
    END IF;
  END IF;
  
  -- إنشاء رسالة البدائل الذكية
  WITH available_variants AS (
    SELECT DISTINCT 
      c.name as color_name,
      s.name as size_name,
      c.id as color_id
    FROM product_variants pv
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_found_product.id
      AND COALESCE(i.quantity - i.reserved_quantity, 0) > 0
    ORDER BY c.name, s.name
  ),
  color_sizes AS (
    SELECT 
      color_name,
      string_agg(size_name, ', ' ORDER BY 
        CASE size_name 
          WHEN 'XS' THEN 1 
          WHEN 'S' THEN 2 
          WHEN 'M' THEN 3 
          WHEN 'L' THEN 4 
          WHEN 'XL' THEN 5 
          WHEN 'XXL' THEN 6 
          ELSE 7 
        END
      ) as sizes
    FROM available_variants
    GROUP BY color_name, color_id
    ORDER BY color_name
  )
  SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
  INTO v_smart_alternatives
  FROM color_sizes;
  
  -- إنشاء رسائل الخطأ
  IF v_color_requested AND v_found_color.id IS NULL THEN
    v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
      'المنتج "%s" اللون "%s" غير متوفر' || E'\n\n' ||
      '✅ الألوان والأحجام المتوفرة:' || E'\n%s', 
      v_found_product.name, v_found_color.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
  ELSIF v_size_requested AND v_found_size.id IS NULL THEN
    v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
      'المنتج "%s" القياس "%s" غير متوفر' || E'\n\n' ||
      '✅ الألوان والأحجام المتوفرة:' || E'\n%s', 
      v_found_product.name, v_found_size.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
  ELSIF v_variant.id IS NOT NULL AND v_variant.available_stock < v_quantity THEN
    -- التعديل المطلوب: تحسين رسالة الكمية غير المتوفرة
    v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
      'المنتج "%s" اللون "%s" القياس "%s" المتاح حاليا %s (مطلوب %s)' || E'\n\n' ||
      '✅ الألوان والأحجام المتوفرة:' || E'\n%s', 
      v_found_product.name, 
      COALESCE(v_found_color.name, 'افتراضي'), 
      COALESCE(v_found_size.name, 'افتراضي'),
      v_variant.available_stock, 
      v_quantity, 
      COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
  ELSIF v_variant.id IS NULL THEN
    IF v_color_requested AND v_size_requested THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" القياس "%s" غير متوفر' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة:' || E'\n%s', 
        v_found_product.name, v_found_color.name, v_found_size.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSE
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" غير متوفر بالمواصفات المطلوبة' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة:' || E'\n%s', 
        v_found_product.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    END IF;
  ELSE
    v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' || 
      'المنتج "%s" غير متوفر حالياً' || E'\n\n' ||
      '✅ الألوان والأحجام المتوفرة:' || E'\n%s', 
      v_found_product.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
  END IF;
  
  RAISE NOTICE '📝 رسالة الخطأ: %', v_alternatives;
  
  RETURN jsonb_build_array(
    jsonb_build_object(
      'product_name', v_found_product.name,
      'color', COALESCE(v_found_color.name, 'غير محدد'),
      'size', COALESCE(v_found_size.name, 'غير محدد'),
      'quantity', v_quantity,
      'price', 15000,
      'total_price', 15000 * v_quantity,
      'is_available', false,
      'alternatives_message', v_alternatives
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ', 
        'color', 'افتراضي',
        'size', 'افتراضي',
        'quantity', v_quantity,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'حدث خطأ في معالجة طلبك'
      )
    );
END;
$function$;