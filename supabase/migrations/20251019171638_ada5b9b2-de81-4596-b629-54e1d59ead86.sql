-- استبدال الدالة بنسخة مبسطة مع دعم +
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_text text;
  v_parts text[];
  v_part text;
  v_products jsonb := '[]'::jsonb;
  v_product record;
  v_color record;
  v_size record;
  v_variant record;
  v_item jsonb;
  v_quantity int := 1;
  v_words text[];
  v_word text;
BEGIN
  RAISE NOTICE '🔍 بدء استخلاص المنتجات من: %', input_text;
  
  -- تقسيم النص على + إذا وجد
  IF POSITION('+' IN input_text) > 0 THEN
    v_parts := string_to_array(input_text, '+');
    RAISE NOTICE '✂️ تم تقسيم النص إلى % أجزاء', array_length(v_parts, 1);
  ELSE
    v_parts := ARRAY[input_text];
  END IF;
  
  -- معالجة كل جزء على حدة
  FOREACH v_part IN ARRAY v_parts LOOP
    v_text := lower(trim(v_part));
    
    IF v_text = '' OR v_text IS NULL THEN
      CONTINUE;
    END IF;
    
    RAISE NOTICE '📝 معالجة الجزء: %', v_text;
    
    -- استخراج الكمية إذا وجدت
    v_quantity := 1;
    v_words := string_to_array(v_text, ' ');
    FOREACH v_word IN ARRAY v_words LOOP
      IF v_word ~ '^\d+$' THEN
        v_quantity := v_word::int;
        RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
        EXIT;
      END IF;
    END LOOP;
    
    -- البحث عن المنتج
    FOR v_product IN
      SELECT p.id, p.name, p.base_price, p.cost_price
      FROM products p
      WHERE p.is_active = true
        AND (
          lower(p.name) = ANY(v_words)
          OR v_text LIKE '%' || lower(p.name) || '%'
          OR lower(p.name) LIKE '%' || v_text || '%'
        )
      ORDER BY 
        CASE 
          WHEN lower(p.name) = v_text THEN 1
          WHEN v_text LIKE lower(p.name) || '%' THEN 2
          WHEN lower(p.name) LIKE v_text || '%' THEN 3
          ELSE 4
        END,
        length(p.name)
      LIMIT 1
    LOOP
      RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_product.name, v_product.id;
      
      -- بناء العنصر الأساسي
      v_item := jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'price', v_product.base_price,
        'quantity', v_quantity,
        'color_id', null,
        'color_name', null,
        'size_id', null,
        'size_name', null,
        'variant_id', null
      );
      
      -- البحث عن اللون
      FOR v_color IN
        SELECT c.id, c.name
        FROM colors c
        WHERE lower(c.name) = ANY(v_words)
           OR v_text LIKE '%' || lower(c.name) || '%'
        ORDER BY length(c.name) DESC
        LIMIT 1
      LOOP
        RAISE NOTICE '🎨 تم العثور على اللون: %', v_color.name;
        v_item := jsonb_set(v_item, '{color_id}', to_jsonb(v_color.id));
        v_item := jsonb_set(v_item, '{color_name}', to_jsonb(v_color.name));
      END LOOP;
      
      -- البحث عن القياس
      FOR v_size IN
        SELECT s.id, s.name
        FROM sizes s
        WHERE lower(s.name) = ANY(v_words)
           OR v_text LIKE '%' || lower(s.name) || '%'
           OR (lower(s.name) = 's' AND v_text LIKE '%سمول%')
           OR (lower(s.name) = 'm' AND v_text LIKE '%ميديم%')
           OR (lower(s.name) = 'l' AND v_text LIKE '%لارج%')
           OR (lower(s.name) = 'xl' AND v_text LIKE '%اكس لارج%')
        ORDER BY length(s.name) DESC
        LIMIT 1
      LOOP
        RAISE NOTICE '📏 تم العثور على القياس: %', v_size.name;
        v_item := jsonb_set(v_item, '{size_id}', to_jsonb(v_size.id));
        v_item := jsonb_set(v_item, '{size_name}', to_jsonb(v_size.name));
      END LOOP;
      
      -- البحث عن variant إذا تم العثور على اللون والقياس
      IF (v_item->>'color_id') IS NOT NULL AND (v_item->>'size_id') IS NOT NULL THEN
        FOR v_variant IN
          SELECT pv.id, pv.price, pv.sku, i.quantity as stock_quantity
          FROM product_variants pv
          LEFT JOIN inventory i ON i.variant_id = pv.id
          WHERE pv.product_id = v_product.id
            AND pv.color_id = (v_item->>'color_id')::uuid
            AND pv.size_id = (v_item->>'size_id')::uuid
          LIMIT 1
        LOOP
          RAISE NOTICE '🔗 تم العثور على variant (ID: %, السعر: %)', v_variant.id, v_variant.price;
          v_item := jsonb_set(v_item, '{variant_id}', to_jsonb(v_variant.id));
          v_item := jsonb_set(v_item, '{price}', to_jsonb(v_variant.price));
          v_item := jsonb_set(v_item, '{sku}', to_jsonb(v_variant.sku));
          v_item := jsonb_set(v_item, '{stock_quantity}', to_jsonb(COALESCE(v_variant.stock_quantity, 0)));
        END LOOP;
      END IF;
      
      -- إضافة العنصر للقائمة
      v_products := v_products || jsonb_build_array(v_item);
      RAISE NOTICE '➕ تمت إضافة المنتج إلى القائمة';
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '🎯 النتيجة النهائية: تم استخلاص % عنصر', jsonb_array_length(v_products);
  RETURN v_products;
END;
$function$;