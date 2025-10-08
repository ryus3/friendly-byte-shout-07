-- استعادة دالة extract_product_items_from_text من النسخة العاملة (1 أكتوبر 2025)
-- هذه النسخة تتضمن p_employee_id والصلاحيات ودعم + والبدائل الذكية

CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(
  input_text text,
  p_employee_id uuid DEFAULT NULL
)
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
  v_found_product record;
  v_found_color record;
  v_found_size record;
  v_variant record;
  v_alternatives text := '';
  v_normalized_text text;
  v_color_requested boolean := false;
  v_size_requested boolean := false;
  v_smart_alternatives text := '';
  v_last_product_id uuid := NULL;
  v_last_product_name text := NULL;
  v_last_color_id uuid := NULL;
  v_last_color_name text := NULL;
  v_item_result jsonb;
  
  v_has_full_access boolean := false;
  v_allowed_categories uuid[];
  v_allowed_departments uuid[];
  v_allowed_types uuid[];
  v_allowed_seasons uuid[];
  v_allowed_colors uuid[];
  v_allowed_sizes uuid[];
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  IF p_employee_id IS NOT NULL THEN
    RAISE NOTICE '🔐 التحقق من صلاحيات الموظف: %', p_employee_id;
    
    SELECT 
      COALESCE(upp.has_full_product_access, false),
      COALESCE(upp.allowed_categories, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_departments, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_product_types, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_seasons_occasions, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_colors, ARRAY[]::uuid[]),
      COALESCE(upp.allowed_sizes, ARRAY[]::uuid[])
    INTO 
      v_has_full_access,
      v_allowed_categories,
      v_allowed_departments,
      v_allowed_types,
      v_allowed_seasons,
      v_allowed_colors,
      v_allowed_sizes
    FROM user_product_permissions upp
    WHERE upp.user_id = p_employee_id
    LIMIT 1;
    
    IF NOT FOUND THEN
      v_has_full_access := false;
      v_allowed_categories := ARRAY[]::uuid[];
      v_allowed_departments := ARRAY[]::uuid[];
      v_allowed_types := ARRAY[]::uuid[];
      v_allowed_seasons := ARRAY[]::uuid[];
      v_allowed_colors := ARRAY[]::uuid[];
      v_allowed_sizes := ARRAY[]::uuid[];
      RAISE NOTICE '⚠️ لم توجد صلاحيات للموظف';
    END IF;
    
    RAISE NOTICE '✅ صلاحيات الموظف: full_access=%, categories=%, departments=%', 
      v_has_full_access, array_length(v_allowed_categories, 1), array_length(v_allowed_departments, 1);
  ELSE
    v_has_full_access := true;
    RAISE NOTICE '🌐 لم يتم تمرير employee_id، وصول كامل';
  END IF;
  
  v_parts := string_to_array(input_text, '+');
  
  FOREACH v_part IN ARRAY v_parts
  LOOP
    v_quantity := 1;
    v_found_product := NULL;
    v_found_color := NULL;
    v_found_size := NULL;
    v_variant := NULL;
    v_color_requested := false;
    v_size_requested := false;
    v_alternatives := '';
    v_smart_alternatives := '';
    
    RAISE NOTICE '📦 معالجة الجزء: %', v_part;
    
    v_normalized_text := regexp_replace(
      regexp_replace(v_part, E'[\r\n]+', ' ', 'g'),
      E'\\s+', ' ', 'g'
    );
    v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
    
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF v_word ~ '^[0-9]{1,3}$' AND v_word::integer BETWEEN 1 AND 100 THEN
        v_quantity := v_word::integer;
        RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
      END IF;
    END LOOP;
    
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF length(v_word) < 2 THEN CONTINUE; END IF;
      
      SELECT p.id, p.name INTO v_found_product
      FROM products p 
      WHERE p.is_active = true 
        AND (lower(p.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(p.name) || '%')
        AND (
          v_has_full_access = true
          OR (
            (array_length(v_allowed_categories, 1) IS NULL OR array_length(v_allowed_categories, 1) = 0 OR p.category_id = ANY(v_allowed_categories))
            AND (array_length(v_allowed_departments, 1) IS NULL OR array_length(v_allowed_departments, 1) = 0 OR p.department_id = ANY(v_allowed_departments))
            AND (array_length(v_allowed_types, 1) IS NULL OR array_length(v_allowed_types, 1) = 0 OR p.product_type_id = ANY(v_allowed_types))
            AND (array_length(v_allowed_seasons, 1) IS NULL OR array_length(v_allowed_seasons, 1) = 0 OR p.season_occasion_id = ANY(v_allowed_seasons))
          )
        )
      ORDER BY 
        CASE WHEN lower(p.name) = v_word THEN 1
             WHEN lower(p.name) LIKE v_word || '%' THEN 2
             ELSE 3 END
      LIMIT 1;
      
      IF v_found_product.id IS NOT NULL THEN
        v_last_product_id := v_found_product.id;
        v_last_product_name := v_found_product.name;
        RAISE NOTICE '🎯 تم العثور على المنتج: %', v_found_product.name;
        EXIT;
      END IF;
    END LOOP;
    
    IF v_found_product.id IS NULL AND v_last_product_id IS NOT NULL THEN
      v_found_product.id := v_last_product_id;
      v_found_product.name := v_last_product_name;
      RAISE NOTICE '🔄 استخدام المنتج السابق: %', v_found_product.name;
    END IF;
    
    IF v_found_product.id IS NULL THEN
      RAISE NOTICE '⚠️ لم يتم العثور على منتج في الجزء: %', v_part;
      
      IF array_length(v_parts, 1) = 1 OR v_last_product_id IS NULL THEN
        RETURN jsonb_build_array(
          jsonb_build_object(
            'product_name', 'غير محدد',
            'color', 'افتراضي',
            'size', 'افتراضي',
            'quantity', v_quantity,
            'price', 0,
            'total_price', 0,
            'is_available', false,
            'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 
              CASE 
                WHEN p_employee_id IS NOT NULL THEN 'لم يتم التعرف على منتج ضمن صلاحياتك في الطلب'
                ELSE 'لم يتم التعرف على أي منتج في الطلب'
              END
          )
        );
      ELSE
        CONTINUE;
      END IF;
    END IF;
    
    FOREACH v_word IN ARRAY v_words
    LOOP
      SELECT c.id, c.name INTO v_found_color
      FROM colors c 
      WHERE (lower(c.name) LIKE '%' || v_word || '%' OR v_word LIKE '%' || lower(c.name) || '%')
        AND (
          v_has_full_access = true
          OR array_length(v_allowed_colors, 1) IS NULL 
          OR array_length(v_allowed_colors, 1) = 0 
          OR c.id = ANY(v_allowed_colors)
        )
      LIMIT 1;
      
      IF v_found_color.id IS NOT NULL THEN
        v_color_requested := true;
        v_last_color_id := v_found_color.id;
        v_last_color_name := v_found_color.name;
        RAISE NOTICE '🎨 تم العثور على اللون: %', v_found_color.name;
        EXIT;
      ELSE
        IF v_word IN ('احمر', 'اخضر', 'اصفر', 'برتقالي', 'بنفسجي', 'وردي', 'رمادي', 'بني') THEN
          v_color_requested := true;
          v_found_color.name := v_word;
          RAISE NOTICE '🎨 تم طلب لون غير متوفر أو غير مسموح: %', v_word;
          EXIT;
        END IF;
      END IF;
    END LOOP;
    
    IF v_found_color.id IS NULL AND NOT v_color_requested AND v_last_color_id IS NOT NULL THEN
      IF v_has_full_access = true 
         OR array_length(v_allowed_colors, 1) IS NULL 
         OR array_length(v_allowed_colors, 1) = 0 
         OR v_last_color_id = ANY(v_allowed_colors) THEN
        v_found_color.id := v_last_color_id;
        v_found_color.name := v_last_color_name;
        v_color_requested := true;
        RAISE NOTICE '🔄 استخدام اللون السابق: %', v_found_color.name;
      END IF;
    END IF;
    
    FOREACH v_word IN ARRAY v_words
    LOOP
      SELECT s.id, s.name INTO v_found_size
      FROM sizes s 
      WHERE (lower(s.name) = v_word
         OR (v_word = 'ميديم' AND lower(s.name) = 'm')
         OR (v_word = 'لارج' AND lower(s.name) = 'l')
         OR (v_word = 'اكس' AND lower(s.name) = 'xl')
         OR (v_word = 'سمول' AND lower(s.name) = 's')
         OR lower(s.name) LIKE '%' || v_word || '%')
        AND (
          v_has_full_access = true
          OR array_length(v_allowed_sizes, 1) IS NULL 
          OR array_length(v_allowed_sizes, 1) = 0 
          OR s.id = ANY(v_allowed_sizes)
        )
      LIMIT 1;
      
      IF v_found_size.id IS NOT NULL THEN
        v_size_requested := true;
        RAISE NOTICE '📏 تم العثور على الحجم: %', v_found_size.name;
        EXIT;
      ELSE
        IF v_word IN ('ميديم', 'لارج', 'سمول', 'اكس', 'دبل', 'كبير', 'صغير', 'وسط', 'xxxl', 'xxl') THEN
          v_size_requested := true;
          v_found_size.name := v_word;
          RAISE NOTICE '📏 تم طلب حجم غير متوفر أو غير مسموح: %', v_word;
          EXIT;
        END IF;
      END IF;
    END LOOP;
    
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
        v_item_result := jsonb_build_object(
          'product_name', v_found_product.name,
          'color', COALESCE(v_found_color.name, 'افتراضي'),
          'size', COALESCE(v_found_size.name, 'افتراضي'),
          'quantity', v_quantity,
          'price', COALESCE(v_variant.price, 15000),
          'total_price', COALESCE(v_variant.price, 15000) * v_quantity,
          'is_available', true,
          'alternatives_message', ''
        );
        v_product_items := v_product_items || jsonb_build_array(v_item_result);
        CONTINUE;
      END IF;
    END IF;
    
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
        AND (
          v_has_full_access = true
          OR (array_length(v_allowed_colors, 1) IS NULL OR array_length(v_allowed_colors, 1) = 0 OR c.id = ANY(v_allowed_colors))
        )
        AND (
          v_has_full_access = true
          OR (array_length(v_allowed_sizes, 1) IS NULL OR array_length(v_allowed_sizes, 1) = 0 OR s.id = ANY(v_allowed_sizes))
        )
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
    
    IF v_color_requested AND v_found_color.id IS NULL THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" غير متوفر' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, v_found_color.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_size_requested AND v_found_size.id IS NULL THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" القياس "%s" غير متوفر' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, v_found_size.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_variant.id IS NOT NULL AND v_variant.available_stock < v_quantity THEN
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
        'المنتج "%s" اللون "%s" القياس "%s" المتاح حاليا %s (مطلوب %s)' || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, 
        COALESCE(v_found_color.name, 'افتراضي'), 
        COALESCE(v_found_size.name, 'افتراضي'),
        v_variant.available_stock, 
        v_quantity, 
        COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    ELSIF v_variant.id IS NULL THEN
      IF v_color_requested AND v_size_requested THEN
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
          'المنتج "%s" اللون "%s" القياس "%s" غير متوفر' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
          '✅ الألوان والأحجام المتوفرة' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
          v_found_product.name, v_found_color.name, v_found_size.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
      ELSE
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' ||
          'المنتج "%s" غير متوفر بالمواصفات المطلوبة' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
          '✅ الألوان والأحجام المتوفرة' || 
          CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
          v_found_product.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
      END IF;
    ELSE
      v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' || 
        'المنتج "%s" غير متوفر حالياً' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' أو غير مسموح لك' ELSE '' END || E'\n\n' ||
        '✅ الألوان والأحجام المتوفرة' || 
        CASE WHEN p_employee_id IS NOT NULL THEN ' لك' ELSE '' END || ':' || E'\n%s', 
        v_found_product.name, COALESCE(v_smart_alternatives, 'لا توجد بدائل متوفرة'));
    END IF;
    
    v_item_result := jsonb_build_object(
      'product_name', v_found_product.name,
      'color', COALESCE(v_found_color.name, 'افتراضي'),
      'size', COALESCE(v_found_size.name, 'افتراضي'),
      'quantity', v_quantity,
      'price', 0,
      'total_price', 0,
      'is_available', false,
      'alternatives_message', v_alternatives
    );
    
    v_product_items := v_product_items || jsonb_build_array(v_item_result);
  END LOOP;
  
  RETURN v_product_items;
END;
$function$;