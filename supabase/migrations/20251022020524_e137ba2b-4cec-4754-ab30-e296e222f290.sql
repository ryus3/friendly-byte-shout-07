-- تحديث دالة استخراج المنتجات بالحل الذكي للمنتجات ذات الكلمتين
-- Smart Global Solution: Three-Stage Prioritized Product Matching

DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

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
  
  -- متغيرات جديدة للبحث الذكي
  v_i integer;
  v_two_word_combo text;
  v_best_priority integer := 999;
  v_temp_product record;
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  v_parts := string_to_array(input_text, '+');
  
  FOREACH v_part IN ARRAY v_parts
  LOOP
    -- إعادة تعيين المتغيرات لكل جزء
    v_quantity := 1;
    v_found_product := NULL;
    v_found_color := NULL;
    v_found_size := NULL;
    v_variant := NULL;
    v_color_requested := false;
    v_size_requested := false;
    v_alternatives := '';
    v_smart_alternatives := '';
    v_best_priority := 999;
    
    RAISE NOTICE '📦 معالجة الجزء: %', v_part;
    
    v_normalized_text := regexp_replace(
      regexp_replace(v_part, E'[\r\n]+', ' ', 'g'),
      E'\\s+', ' ', 'g'
    );
    v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
    
    -- البحث عن الكمية
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF v_word ~ '^[0-9]{1,3}$' AND v_word::integer BETWEEN 1 AND 100 THEN
        v_quantity := v_word::integer;
        RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
      END IF;
    END LOOP;
    
    -- 🎯 STAGE 1: البحث عن تطابق تام (Exact Match) - الأولوية 1
    SELECT p.id, p.name, 1 as priority INTO v_temp_product
    FROM products p 
    WHERE p.is_active = true 
      AND lower(trim(p.name)) = lower(trim(v_normalized_text))
    LIMIT 1;
    
    IF v_temp_product.id IS NOT NULL THEN
      v_found_product := v_temp_product;
      v_best_priority := v_temp_product.priority;
      RAISE NOTICE '🎯 [Priority 1] تطابق تام: %', v_found_product.name;
    END IF;
    
    -- 🎯 STAGE 2: البحث عن كلمتين متتاليتين (Two-Word Consecutive Match) - الأولوية 2-3
    IF v_found_product.id IS NULL AND array_length(v_words, 1) >= 2 THEN
      FOR v_i IN 1..(array_length(v_words, 1) - 1)
      LOOP
        -- تجاهل الكلمات القصيرة والأرقام
        IF length(v_words[v_i]) < 2 OR length(v_words[v_i + 1]) < 2 THEN
          CONTINUE;
        END IF;
        
        IF v_words[v_i] ~ '^[0-9]+$' OR v_words[v_i + 1] ~ '^[0-9]+$' THEN
          CONTINUE;
        END IF;
        
        v_two_word_combo := v_words[v_i] || ' ' || v_words[v_i + 1];
        RAISE NOTICE '🔍 البحث عن كلمتين: "%"', v_two_word_combo;
        
        -- البحث عن تطابق تام لكلمتين (Priority 2)
        SELECT p.id, p.name, 2 as priority INTO v_temp_product
        FROM products p 
        WHERE p.is_active = true 
          AND lower(trim(p.name)) = v_two_word_combo
        LIMIT 1;
        
        IF v_temp_product.id IS NOT NULL THEN
          v_found_product := v_temp_product;
          v_best_priority := v_temp_product.priority;
          RAISE NOTICE '🎯 [Priority 2] تطابق تام لكلمتين: %', v_found_product.name;
          EXIT;
        END IF;
        
        -- البحث عن احتواء كلمتين (Priority 3)
        SELECT p.id, p.name, 3 as priority INTO v_temp_product
        FROM products p 
        WHERE p.is_active = true 
          AND lower(p.name) LIKE '%' || v_two_word_combo || '%'
        ORDER BY 
          CASE WHEN lower(p.name) LIKE v_two_word_combo || '%' THEN 1 ELSE 2 END
        LIMIT 1;
        
        IF v_temp_product.id IS NOT NULL AND v_temp_product.priority < v_best_priority THEN
          v_found_product := v_temp_product;
          v_best_priority := v_temp_product.priority;
          RAISE NOTICE '🎯 [Priority 3] يحتوي على كلمتين: %', v_found_product.name;
        END IF;
      END LOOP;
    END IF;
    
    -- 🎯 STAGE 3: البحث عن كلمة واحدة (Single Word Match) - الأولوية 4-6
    IF v_found_product.id IS NULL THEN
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF length(v_word) < 2 OR v_word ~ '^[0-9]+$' THEN 
          CONTINUE; 
        END IF;
        
        -- تطابق تام لكلمة واحدة (Priority 4)
        SELECT p.id, p.name, 4 as priority INTO v_temp_product
        FROM products p 
        WHERE p.is_active = true 
          AND lower(p.name) = v_word
        LIMIT 1;
        
        IF v_temp_product.id IS NOT NULL THEN
          v_found_product := v_temp_product;
          v_best_priority := v_temp_product.priority;
          RAISE NOTICE '🎯 [Priority 4] تطابق تام لكلمة: %', v_found_product.name;
          EXIT;
        END IF;
        
        -- يبدأ بكلمة (Priority 5)
        SELECT p.id, p.name, 5 as priority INTO v_temp_product
        FROM products p 
        WHERE p.is_active = true 
          AND lower(p.name) LIKE v_word || '%'
        LIMIT 1;
        
        IF v_temp_product.id IS NOT NULL AND v_temp_product.priority < v_best_priority THEN
          v_found_product := v_temp_product;
          v_best_priority := v_temp_product.priority;
          RAISE NOTICE '🎯 [Priority 5] يبدأ بكلمة: %', v_found_product.name;
        END IF;
        
        -- يحتوي على كلمة (Priority 6)
        IF v_found_product.id IS NULL THEN
          SELECT p.id, p.name, 6 as priority INTO v_temp_product
          FROM products p 
          WHERE p.is_active = true 
            AND lower(p.name) LIKE '%' || v_word || '%'
          LIMIT 1;
          
          IF v_temp_product.id IS NOT NULL AND v_temp_product.priority < v_best_priority THEN
            v_found_product := v_temp_product;
            v_best_priority := v_temp_product.priority;
            RAISE NOTICE '🎯 [Priority 6] يحتوي على كلمة: %', v_found_product.name;
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    IF v_found_product.id IS NOT NULL THEN
      v_last_product_id := v_found_product.id;
      v_last_product_name := v_found_product.name;
      RAISE NOTICE '✅ المنتج النهائي المختار (Priority %): %', v_best_priority, v_found_product.name;
    END IF;
    
    -- إذا لم نجد منتج في الجزء الحالي، استخدم المنتج السابق
    IF v_found_product.id IS NULL AND v_last_product_id IS NOT NULL THEN
      v_found_product.id := v_last_product_id;
      v_found_product.name := v_last_product_name;
      RAISE NOTICE '🔄 استخدام المنتج السابق: %', v_found_product.name;
    END IF;
    
    -- إذا لم يتم العثور على منتج نهائياً
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
            'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب'
          )
        );
      ELSE
        CONTINUE;
      END IF;
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
        v_color_requested := true;
        v_last_color_id := v_found_color.id;
        v_last_color_name := v_found_color.name;
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
    
    IF v_found_color.id IS NULL AND NOT v_color_requested AND v_last_color_id IS NOT NULL THEN
      v_found_color.id := v_last_color_id;
      v_found_color.name := v_last_color_name;
      v_color_requested := true;
      RAISE NOTICE '🔄 استخدام اللون السابق: %', v_found_color.name;
    END IF;
    
    -- البحث عن الحجم
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
    
    v_item_result := jsonb_build_object(
      'product_name', v_found_product.name,
      'color', COALESCE(v_found_color.name, 'غير محدد'),
      'size', COALESCE(v_found_size.name, 'غير محدد'),
      'quantity', v_quantity,
      'price', 15000,
      'total_price', 15000 * v_quantity,
      'is_available', false,
      'alternatives_message', v_alternatives
    );
    v_product_items := v_product_items || jsonb_build_array(v_item_result);
  END LOOP;
  
  IF jsonb_array_length(v_product_items) = 0 THEN
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'غير محدد',
        'color', 'افتراضي',
        'size', 'افتراضي',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب'
      )
    );
  END IF;
  
  RETURN v_product_items;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في استخراج المنتجات: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_array(
      jsonb_build_object(
        'product_name', 'خطأ', 
        'color', 'افتراضي',
        'size', 'افتراضي',
        'quantity', 1,
        'price', 0,
        'total_price', 0,
        'is_available', false,
        'alternatives_message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'حدث خطأ في معالجة طلبك'
      )
    );
END;
$function$;