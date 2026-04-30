CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parts text[];
  v_part text;
  v_words text[];
  v_word text;
  v_product_items jsonb := '[]';
  v_quantity integer := 1;

  -- متغيرات سكالار آمنة بدلاً من record (تحل خطأ NULL record)
  v_found_product_id uuid;
  v_found_product_name text;
  v_found_color_id uuid;
  v_found_color_name text;
  v_found_size_id uuid;
  v_found_size_name text;

  v_variant_id uuid;
  v_variant_price numeric;
  v_variant_stock integer;

  v_alternatives text := '';
  v_normalized_text text;
  v_color_requested boolean := false;
  v_size_requested boolean := false;
  v_smart_alternatives text := '';

  -- متغيرات التوريث بين أجزاء "+"
  v_inherited_product_id uuid := NULL;
  v_inherited_product_name text := NULL;
  v_inherited_color_id uuid := NULL;
  v_inherited_color_name text := NULL;
  v_inherited_size_id uuid := NULL;
  v_inherited_size_name text := NULL;

  v_product_was_explicit boolean := false;
  v_item_result jsonb;
  v_search_text text;
BEGIN
  v_parts := string_to_array(input_text, '+');
  FOREACH v_part IN ARRAY v_parts
  LOOP
    -- إعادة تصفير محلية لكل جزء
    v_quantity := 1;
    v_found_product_id := NULL;
    v_found_product_name := NULL;
    v_found_color_id := NULL;
    v_found_color_name := NULL;
    v_found_size_id := NULL;
    v_found_size_name := NULL;
    v_variant_id := NULL;
    v_variant_price := NULL;
    v_variant_stock := NULL;
    v_color_requested := false;
    v_size_requested := false;
    v_alternatives := '';
    v_smart_alternatives := '';
    v_product_was_explicit := false;

    v_normalized_text := regexp_replace(regexp_replace(v_part, E'[\n\r]+', ' ', 'g'), E'\\s+', ' ', 'g');
    v_normalized_text := regexp_replace(v_normalized_text, 'اكس لارج', 'xl', 'gi');
    v_normalized_text := regexp_replace(v_normalized_text, 'اكسين لارج', 'xxl', 'gi');
    v_normalized_text := regexp_replace(v_normalized_text, 'ثلاث اكسات', 'xxxl', 'gi');
    v_normalized_text := regexp_replace(v_normalized_text, 'ثلاثة اكس', 'xxxl', 'gi');
    v_normalized_text := regexp_replace(v_normalized_text, 'ثلاثه اكس', 'xxxl', 'gi');
    v_words := string_to_array(lower(trim(v_normalized_text)), ' ');

    -- استخراج الكمية
    FOREACH v_word IN ARRAY v_words LOOP
      IF v_word ~ '^[0-9]{1,3}$' AND v_word::integer BETWEEN 1 AND 100 THEN
        v_quantity := v_word::integer;
      END IF;
    END LOOP;

    -- البحث عن المنتج (3 كلمات)
    FOR i IN 1..GREATEST(COALESCE(array_length(v_words, 1), 0) - 2, 0) LOOP
      IF length(v_words[i]) < 2 THEN CONTINUE; END IF;
      v_search_text := v_words[i] || ' ' || v_words[i+1] || ' ' || v_words[i+2];
      SELECT p.id::uuid, p.name
      INTO v_found_product_id, v_found_product_name
      FROM products_cache p
      WHERE lower(p.name) % v_search_text OR lower(p.name) LIKE '%' || v_search_text || '%'
      ORDER BY similarity(lower(p.name), v_search_text) DESC,
               CASE WHEN lower(p.name) = v_search_text THEN 1 ELSE 2 END
      LIMIT 1;
      IF v_found_product_id IS NOT NULL THEN
        v_product_was_explicit := true;
        EXIT;
      END IF;
    END LOOP;

    -- البحث عن المنتج (كلمتان)
    IF v_found_product_id IS NULL THEN
      FOR i IN 1..GREATEST(COALESCE(array_length(v_words, 1), 0) - 1, 0) LOOP
        IF length(v_words[i]) < 2 THEN CONTINUE; END IF;
        v_search_text := v_words[i] || ' ' || v_words[i+1];
        SELECT p.id::uuid, p.name
        INTO v_found_product_id, v_found_product_name
        FROM products_cache p
        WHERE lower(p.name) % v_search_text OR lower(p.name) LIKE '%' || v_search_text || '%'
        ORDER BY similarity(lower(p.name), v_search_text) DESC,
                 CASE WHEN lower(p.name) = v_search_text THEN 1 ELSE 2 END
        LIMIT 1;
        IF v_found_product_id IS NOT NULL THEN
          v_product_was_explicit := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- البحث عن المنتج (كلمة واحدة)
    IF v_found_product_id IS NULL THEN
      FOREACH v_word IN ARRAY v_words LOOP
        IF length(v_word) < 2 THEN CONTINUE; END IF;
        SELECT p.id::uuid, p.name
        INTO v_found_product_id, v_found_product_name
        FROM products_cache p
        WHERE lower(p.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(p.name) || '%'
        ORDER BY CASE WHEN lower(p.name) = v_word THEN 1
                      WHEN lower(p.name) LIKE v_word || '%' THEN 2
                      ELSE 3 END
        LIMIT 1;
        IF v_found_product_id IS NOT NULL THEN
          v_product_was_explicit := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- توريث المنتج إذا لم يُذكر صراحة
    IF v_found_product_id IS NULL AND v_inherited_product_id IS NOT NULL THEN
      v_found_product_id := v_inherited_product_id;
      v_found_product_name := v_inherited_product_name;
      v_product_was_explicit := false;
    END IF;

    -- إذا لم يوجد منتج مطلقاً
    IF v_found_product_id IS NULL THEN
      IF COALESCE(array_length(v_parts, 1), 1) = 1 THEN
        RETURN jsonb_build_array(jsonb_build_object(
          'product_name', 'غير محدد', 'color', '-', 'size', '-',
          'quantity', v_quantity, 'price', 0, 'total_price', 0, 'is_available', false,
          'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب'
        ));
      ELSE
        CONTINUE;
      END IF;
    END IF;

    -- البحث عن اللون في الجزء الحالي
    FOREACH v_word IN ARRAY v_words LOOP
      SELECT (color_item->>'id')::uuid, color_item->>'name'
      INTO v_found_color_id, v_found_color_name
      FROM products_cache p, jsonb_array_elements(p.colors) AS color_item
      WHERE p.id = v_found_product_id
        AND (lower(color_item->>'name') LIKE '%' || v_word || '%'
             OR v_word LIKE '%' || lower(color_item->>'name') || '%')
      LIMIT 1;
      IF v_found_color_id IS NOT NULL THEN
        v_color_requested := true;
        EXIT;
      ELSE
        IF v_word IN ('احمر', 'اخضر', 'اصفر', 'برتقالي', 'بنفسجي', 'وردي', 'رمادي', 'بني', 'ازرق', 'اسود', 'ابيض', 'نيلي', 'مكسيكي') THEN
          v_color_requested := true;
          v_found_color_name := v_word;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    -- توريث اللون: فقط إذا لم يُذكر لون في الجزء الحالي ولم يُذكر منتج جديد صراحة
    IF NOT v_color_requested AND NOT v_product_was_explicit AND v_inherited_color_id IS NOT NULL THEN
      v_found_color_id := v_inherited_color_id;
      v_found_color_name := v_inherited_color_name;
      v_color_requested := true;
    END IF;

    -- البحث عن القياس في الجزء الحالي
    FOREACH v_word IN ARRAY v_words LOOP
      SELECT (size_item->>'id')::uuid, size_item->>'name'
      INTO v_found_size_id, v_found_size_name
      FROM products_cache p, jsonb_array_elements(p.sizes) AS size_item
      WHERE p.id = v_found_product_id
        AND (lower(size_item->>'name') = v_word
             OR (v_word = 'سمول' AND lower(size_item->>'name') = 's')
             OR (v_word = 'ميديم' AND lower(size_item->>'name') = 'm')
             OR (v_word = 'لارج' AND lower(size_item->>'name') = 'l')
             OR (v_word = 'اكس' AND lower(size_item->>'name') = 'xl')
             OR (v_word = 'اكسين' AND lower(size_item->>'name') = 'xxl')
             OR (v_word = '2xxl' AND lower(size_item->>'name') = 'xxl')
             OR (v_word = '3xl' AND lower(size_item->>'name') = 'xxxl')
             OR lower(size_item->>'name') LIKE '%' || v_word || '%')
      LIMIT 1;
      IF v_found_size_id IS NOT NULL THEN
        v_size_requested := true;
        EXIT;
      ELSE
        IF v_word IN ('ميديم', 'لارج', 'سمول', 'اكس', 'اكسين', '2xxl', '3xl', 'كبير', 'صغير', 'وسط', 'xxxl', 'xxl', 'xl') THEN
          v_size_requested := true;
          v_found_size_name := v_word;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    -- توريث القياس: فقط إذا لم يُذكر قياس في الجزء الحالي ولم يُذكر منتج جديد صراحة
    IF NOT v_size_requested AND NOT v_product_was_explicit AND v_inherited_size_id IS NOT NULL THEN
      v_found_size_id := v_inherited_size_id;
      v_found_size_name := v_inherited_size_name;
      v_size_requested := true;
    END IF;

    -- البحث عن variant مطابق وفحص المخزون
    IF (NOT v_color_requested OR v_found_color_id IS NOT NULL)
       AND (NOT v_size_requested OR v_found_size_id IS NOT NULL) THEN
      SELECT pv.id, pv.price, COALESCE(i.quantity - i.reserved_quantity, 0)
      INTO v_variant_id, v_variant_price, v_variant_stock
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND (v_found_color_id IS NULL OR pv.color_id = v_found_color_id)
        AND (v_found_size_id IS NULL OR pv.size_id = v_found_size_id)
      ORDER BY COALESCE(i.quantity - i.reserved_quantity, 0) DESC
      LIMIT 1;

      IF v_variant_id IS NOT NULL AND v_variant_stock >= v_quantity THEN
        v_item_result := jsonb_build_object(
          'product_name', v_found_product_name,
          'color', COALESCE(v_found_color_name, '-'),
          'size', COALESCE(v_found_size_name, '-'),
          'quantity', v_quantity,
          'price', COALESCE(v_variant_price, 15000),
          'total_price', COALESCE(v_variant_price, 15000) * v_quantity,
          'is_available', true,
          'alternatives_message', ''
        );
        v_product_items := v_product_items || jsonb_build_array(v_item_result);

        -- تحديث متغيرات التوريث للجزء التالي
        v_inherited_product_id := v_found_product_id;
        v_inherited_product_name := v_found_product_name;
        v_inherited_color_id := v_found_color_id;
        v_inherited_color_name := v_found_color_name;
        v_inherited_size_id := v_found_size_id;
        v_inherited_size_name := v_found_size_name;
        CONTINUE;
      END IF;
    END IF;

    -- بناء رسالة البدائل الذكية
    WITH available_variants AS (
      SELECT DISTINCT c.name as color_name, s.name as size_name, c.id as color_id
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product_id
        AND COALESCE(i.quantity - i.reserved_quantity, 0) > 0
      ORDER BY c.name, s.name
    ),
    color_sizes AS (
      SELECT color_name,
        string_agg(size_name, ', ' ORDER BY
          CASE size_name WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
                         WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 ELSE 7 END
        ) as sizes
      FROM available_variants
      GROUP BY color_name, color_id
      ORDER BY color_name
    )
    SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
    INTO v_smart_alternatives FROM color_sizes;

    IF v_color_requested AND v_found_color_id IS NULL THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" غير متوفر' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة:' || E'\n%s',
        v_found_product_name, COALESCE(v_found_color_name, '-'), COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_size_requested AND v_found_size_id IS NULL THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" القياس "%s" غير متوفر' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة:' || E'\n%s',
        v_found_product_name, COALESCE(v_found_size_name, '-'), COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_variant_id IS NOT NULL AND v_variant_stock < v_quantity THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" القياس "%s" المتاح حاليا %s (مطلوب %s)' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة:' || E'\n%s',
        v_found_product_name, COALESCE(v_found_color_name, '-'), COALESCE(v_found_size_name, '-'),
        v_variant_stock, v_quantity,
        COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_variant_id IS NULL THEN
      IF v_color_requested AND v_size_requested THEN
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
          'المنتج "%s" اللون "%s" القياس "%s" غير متوفر' || E'\n\n' ||
          '✅ الألوان والأحجام المتوفرة:' || E'\n%s',
          v_found_product_name, COALESCE(v_found_color_name, '-'), COALESCE(v_found_size_name, '-'),
          COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
      ELSE
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
          'المنتج "%s" غير متوفر بالمواصفات المطلوبة' || E'\n\n' ||
          '✅ الألوان والأحجام المتوفرة:' || E'\n%s',
          v_found_product_name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
      END IF;
    ELSE
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" غير متوفر حالياً' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة:' || E'\n%s',
        v_found_product_name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    END IF;

    v_item_result := jsonb_build_object(
      'product_name', v_found_product_name,
      'color', COALESCE(v_found_color_name, 'غير محدد'),
      'size', COALESCE(v_found_size_name, 'غير محدد'),
      'quantity', v_quantity, 'price', 15000,
      'total_price', 15000 * v_quantity, 'is_available', false,
      'alternatives_message', v_alternatives
    );
    v_product_items := v_product_items || jsonb_build_array(v_item_result);

    -- حتى عند الفشل، حدّث متغيرات التوريث ليتمكن الجزء التالي من الاستفادة
    v_inherited_product_id := v_found_product_id;
    v_inherited_product_name := v_found_product_name;
    IF v_found_color_id IS NOT NULL THEN
      v_inherited_color_id := v_found_color_id;
      v_inherited_color_name := v_found_color_name;
    END IF;
    IF v_found_size_id IS NOT NULL THEN
      v_inherited_size_id := v_found_size_id;
      v_inherited_size_name := v_found_size_name;
    END IF;
  END LOOP;

  IF jsonb_array_length(v_product_items) = 0 THEN
    RETURN jsonb_build_array(jsonb_build_object(
      'product_name', 'غير محدد', 'color', '-', 'size', '-',
      'quantity', 1, 'price', 0, 'total_price', 0, 'is_available', false,
      'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب'
    ));
  END IF;

  RETURN v_product_items;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_array(jsonb_build_object(
    'product_name', 'خطأ', 'color', '-', 'size', '-',
    'quantity', 1, 'price', 0, 'total_price', 0, 'is_available', false,
    'alternatives_message', '❌ خطأ تقني: ' || SQLERRM
  ));
END;
$function$;