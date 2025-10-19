-- ==========================================
-- النسخة النهائية المتوازنة لـ extract_product_items_from_text
-- دعم كامل لـ + مع الذاكرة الذكية وتعميم القياس
-- ==========================================

CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
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
  v_last_size_id uuid := NULL;
  v_last_size_name text := NULL;
  v_item_result jsonb;
  v_temp_items jsonb[] := ARRAY[]::jsonb[];
  v_found_size_for_line record;
  v_size_count_in_line integer := 0;
  i integer;
BEGIN
  RAISE NOTICE '🔄 بدء استخراج المنتجات من النص: %', input_text;
  
  -- تقسيم النص إلى سطور
  v_lines := string_to_array(input_text, E'\n');
  
  -- معالجة كل سطر على حدة
  FOREACH v_line IN ARRAY v_lines
  LOOP
    v_line := TRIM(v_line);
    
    IF v_line = '' OR v_line IS NULL THEN
      CONTINUE;
    END IF;
    
    RAISE NOTICE '📝 معالجة السطر: %', v_line;
    
    -- تقسيم السطر على علامة +
    v_parts := string_to_array(v_line, '+');
    
    -- إعادة تعيين متغيرات السطر
    v_temp_items := ARRAY[]::jsonb[];
    v_found_size_for_line := NULL;
    v_size_count_in_line := 0;
    
    -- معالجة كل جزء من السطر
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
      
      RAISE NOTICE '📦 معالجة الجزء: %', v_part;
      
      -- تطبيع النص وتقسيمه إلى كلمات
      v_normalized_text := regexp_replace(
        regexp_replace(v_part, E'[\r\n]+', ' ', 'g'),
        E'\\s+', ' ', 'g'
      );
      v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
      
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
          v_last_product_id := v_found_product.id;
          v_last_product_name := v_found_product.name;
          RAISE NOTICE '🎯 تم العثور على المنتج: %', v_found_product.name;
          EXIT;
        END IF;
      END LOOP;
      
      -- إذا لم نجد منتج في الجزء الحالي، استخدم المنتج السابق
      IF v_found_product.id IS NULL AND v_last_product_id IS NOT NULL THEN
        v_found_product.id := v_last_product_id;
        v_found_product.name := v_last_product_name;
        RAISE NOTICE '🔄 استخدام المنتج السابق: %', v_found_product.name;
      END IF;
      
      -- إذا لم يتم العثور على منتج في هذا الجزء، نتجاهله
      IF v_found_product.id IS NULL THEN
        RAISE NOTICE '⚠️ لم يتم العثور على منتج في الجزء: %', v_part;
        CONTINUE;
      END IF;
      
      -- البحث عن القياس
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF v_word ~ '^[0-9]+$' THEN
          SELECT s.id, s.name INTO v_found_size
          FROM sizes s 
          WHERE s.name = v_word;
          
          IF v_found_size.id IS NOT NULL THEN
            v_size_requested := true;
            v_size_count_in_line := v_size_count_in_line + 1;
            v_found_size_for_line := v_found_size;
            v_last_size_id := v_found_size.id;
            v_last_size_name := v_found_size.name;
            RAISE NOTICE '📏 تم العثور على القياس الرقمي: %', v_found_size.name;
            EXIT;
          END IF;
        ELSE
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
            v_size_count_in_line := v_size_count_in_line + 1;
            v_found_size_for_line := v_found_size;
            v_last_size_id := v_found_size.id;
            v_last_size_name := v_found_size.name;
            RAISE NOTICE '📏 تم العثور على القياس: %', v_found_size.name;
            EXIT;
          ELSE
            IF v_word IN ('ميديم', 'لارج', 'سمول', 'اكس', 'دبل', 'كبير', 'صغير', 'وسط', 'xxxl', 'xxl') THEN
              v_size_requested := true;
              v_found_size.name := v_word;
              RAISE NOTICE '📏 تم طلب قياس غير متوفر: %', v_word;
              EXIT;
            END IF;
          END IF;
        END IF;
      END LOOP;
      
      -- استخدام القياس السابق إذا لم نجد قياس جديد
      IF v_found_size.id IS NULL AND NOT v_size_requested AND v_last_size_id IS NOT NULL THEN
        v_found_size.id := v_last_size_id;
        v_found_size.name := v_last_size_name;
        v_size_requested := true;
        RAISE NOTICE '🔄 استخدام القياس السابق: %', v_found_size.name;
      END IF;
      
      -- البحث عن الكمية (فقط الأرقام التي ليست قياسات)
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF v_word ~ '^[0-9]+$' THEN
          DECLARE
            is_size boolean := false;
          BEGIN
            SELECT EXISTS(SELECT 1 FROM sizes WHERE name = v_word) INTO is_size;
            
            IF NOT is_size THEN
              v_quantity := v_word::integer;
              RAISE NOTICE '🔢 تم العثور على الكمية: %', v_quantity;
            END IF;
          END;
        END IF;
      END LOOP;
      
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
      
      -- استخدام اللون السابق إذا لم نجد لون جديد
      IF v_found_color.id IS NULL AND NOT v_color_requested AND v_last_color_id IS NOT NULL THEN
        v_found_color.id := v_last_color_id;
        v_found_color.name := v_last_color_name;
        v_color_requested := true;
        RAISE NOTICE '🔄 استخدام اللون السابق: %', v_found_color.name;
      END IF;
      
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
          v_temp_items := array_append(v_temp_items, v_item_result);
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
      ELSE
        v_alternatives := format('❌ لم يتم إنشاء طلب!' || E'\n' || 
          'المنتج "%s" غير متوفر بالمواصفات المطلوبة' || E'\n\n' ||
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
      v_temp_items := array_append(v_temp_items, v_item_result);
    END LOOP;
    
    -- تطبيق تعميم القياس إذا كان هناك قياس واحد فقط في السطر
    IF v_size_count_in_line = 1 AND v_found_size_for_line.id IS NOT NULL AND array_length(v_temp_items, 1) > 1 THEN
      RAISE NOTICE '🎯 تعميم القياس "%s" على جميع منتجات السطر', v_found_size_for_line.name;
      
      FOR i IN 1..array_length(v_temp_items, 1) LOOP
        IF (v_temp_items[i]->>'size') IN ('افتراضي', 'غير محدد') THEN
          SELECT pv.id, pv.price, COALESCE(inv.quantity - inv.reserved_quantity, 0) as available_stock
          INTO v_variant
          FROM product_variants pv
          LEFT JOIN inventory inv ON pv.id = inv.variant_id
          WHERE pv.product_id = v_last_product_id
            AND pv.size_id = v_found_size_for_line.id
            AND (v_last_color_id IS NULL OR pv.color_id = v_last_color_id)
          LIMIT 1;
          
          IF v_variant.id IS NOT NULL THEN
            v_temp_items[i] := jsonb_build_object(
              'product_name', v_temp_items[i]->>'product_name',
              'color', v_temp_items[i]->>'color',
              'size', v_found_size_for_line.name,
              'quantity', (v_temp_items[i]->>'quantity')::integer,
              'price', COALESCE(v_variant.price, 15000),
              'total_price', COALESCE(v_variant.price, 15000) * (v_temp_items[i]->>'quantity')::integer,
              'is_available', v_variant.available_stock >= (v_temp_items[i]->>'quantity')::integer,
              'alternatives_message', CASE 
                WHEN v_variant.available_stock >= (v_temp_items[i]->>'quantity')::integer THEN ''
                ELSE v_temp_items[i]->>'alternatives_message'
              END
            );
          END IF;
        END IF;
      END LOOP;
    END IF;
    
    -- إضافة المنتجات من السطر إلى النتيجة النهائية
    IF array_length(v_temp_items, 1) > 0 THEN
      FOR i IN 1..array_length(v_temp_items, 1) LOOP
        v_product_items := v_product_items || jsonb_build_array(v_temp_items[i]);
      END LOOP;
    END IF;
  END LOOP;
  
  -- إذا لم نجد أي منتجات
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