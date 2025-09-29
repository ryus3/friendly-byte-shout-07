-- إصلاح شامل لدالة extract_product_items_from_text - إرجاع النظام للعمل الصحيح
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

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
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن الكمية
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_word ~ '^[0-9]+$' AND v_word::integer BETWEEN 1 AND 100 THEN
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
        'color_name', 'افتراضي',
        'size_name', 'افتراضي',
        'quantity', v_quantity,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'لم يتم التعرف على أي منتج في الطلب. يرجى كتابة اسم المنتج بوضوح.'
      )
    );
  END IF;
  
  -- البحث عن اللون
  FOREACH v_word IN ARRAY v_words
  LOOP
    SELECT c.id, c.name INTO v_found_color
    FROM colors c 
    WHERE lower(c.name) LIKE '%' || v_word || '%' 
       OR v_word LIKE '%' || lower(c.name) || '%'
    LIMIT 1;
    
    IF v_found_color.id IS NOT NULL THEN
      RAISE NOTICE '🎨 تم العثور على اللون: %', v_found_color.name;
      EXIT;
    END IF;
  END LOOP;
  
  -- البحث عن الحجم مع تطبيع أسماء الأحجام
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
      RAISE NOTICE '📏 تم العثور على الحجم: %', v_found_size.name;
      EXIT;
    END IF;
  END LOOP;
  
  -- البحث عن المتغير المحدد
  SELECT pv.id, pv.price, COALESCE(i.quantity, 0) as stock
  INTO v_variant
  FROM product_variants pv
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE pv.product_id = v_found_product.id
    AND (v_found_color.id IS NULL OR pv.color_id = v_found_color.id)
    AND (v_found_size.id IS NULL OR pv.size_id = v_found_size.id)
  ORDER BY COALESCE(i.quantity, 0) DESC
  LIMIT 1;
  
  -- إذا وُجد المتغير وهو متوفر
  IF v_variant.id IS NOT NULL AND v_variant.stock >= v_quantity THEN
    RAISE NOTICE '✅ المنتج متوفر';
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', v_found_product.name,
        'color_name', COALESCE(v_found_color.name, 'افتراضي'),
        'size_name', COALESCE(v_found_size.name, 'افتراضي'),
        'quantity', v_quantity,
        'price', COALESCE(v_variant.price, 15000),
        'total_price', COALESCE(v_variant.price, 15000) * v_quantity,
        'is_available', true,
        'alternatives_message', ''
      )
    );
  END IF;
  
  -- إنشاء رسالة البدائل البسيطة
  SELECT string_agg(DISTINCT c.name, ', ')
  INTO v_alternatives
  FROM product_variants pv
  JOIN colors c ON pv.color_id = c.id
  LEFT JOIN inventory i ON pv.id = i.variant_id
  WHERE pv.product_id = v_found_product.id
    AND COALESCE(i.quantity, 0) > 0;
  
  IF v_alternatives IS NULL OR v_alternatives = '' THEN
    v_alternatives := format('❌ المنتج "%s" غير متوفر حالياً.', v_found_product.name);
  ELSE
    v_alternatives := format('❌ اللون "%s" غير متوفر لمنتج "%s".', 
      COALESCE(v_found_color.name, 'المطلوب'), v_found_product.name) || E'\n' ||
      '✅ الألوان المتوفرة: ' || v_alternatives;
  END IF;
  
  RAISE NOTICE '📝 رسالة البدائل: %', v_alternatives;
  
  -- إرجاع المنتج غير المتوفر مع البدائل
  RETURN jsonb_build_array(
    jsonb_build_object(
      'product_name', v_found_product.name,
      'color_name', COALESCE(v_found_color.name, 'افتراضي'),
      'size_name', COALESCE(v_found_size.name, 'افتراضي'),
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
        'color_name', 'افتراضي',
        'size_name', 'افتراضي',
        'quantity', v_quantity,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', 'حدث خطأ في معالجة طلبك: ' || SQLERRM
      )
    );
END;
$function$;