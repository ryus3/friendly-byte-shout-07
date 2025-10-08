-- تعديل دالة extract_product_items_from_text لإرجاع مصفوفة مباشرة مع is_available
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(p_message_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_items jsonb := '[]'::jsonb;
  
  v_phone_line_index integer := 0;
  v_current_index integer := 0;
  
  v_product_name text;
  v_color_name text;
  v_size_name text;
  v_quantity integer;
  v_found_product RECORD;
  v_found_color RECORD;
  v_found_size RECORD;
  v_variant_id uuid;
  v_available_quantity integer;
  v_price numeric;
  v_item jsonb;
  v_error_message text := '';
  v_smart_alternatives text := '';
BEGIN
  RAISE NOTICE '🔍 بدء استخراج المنتجات من النص: %', p_message_text;
  
  -- تقسيم النص إلى سطور
  v_lines := string_to_array(p_message_text, E'\n');
  
  -- ✨ المرحلة 1: اكتشاف سطر الهاتف (9+ أرقام متتالية)
  v_current_index := 0;
  FOREACH v_line IN ARRAY v_lines LOOP
    v_current_index := v_current_index + 1;
    
    -- فحص: هل السطر يحتوي على 9 أرقام فأكثر متتالية؟
    IF v_line ~ '[0-9]{9,}' THEN
      v_phone_line_index := v_current_index;
      RAISE NOTICE '📞 تم اكتشاف سطر الهاتف رقم: % (السطر: %)', v_phone_line_index, v_line;
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم نجد رقم هاتف، نبدأ من السطر الثالث (افتراضي)
  IF v_phone_line_index = 0 THEN
    v_phone_line_index := 2;
    RAISE NOTICE '⚠️ لم يتم العثور على رقم هاتف - سنبدأ من السطر الثالث افتراضياً';
  END IF;
  
  -- ✨ المرحلة 2: معالجة السطور بعد الهاتف فقط
  v_current_index := 0;
  FOREACH v_line IN ARRAY v_lines LOOP
    v_current_index := v_current_index + 1;
    v_line := TRIM(v_line);
    
    -- تجاهل السطور الفارغة
    IF v_line = '' THEN
      CONTINUE;
    END IF;
    
    -- ✅ تجاهل كل شيء قبل وحتى سطر الهاتف
    IF v_current_index <= v_phone_line_index THEN
      RAISE NOTICE '⏭️ تجاهل السطر % (قبل/أثناء الهاتف): %', v_current_index, v_line;
      CONTINUE;
    END IF;
    
    -- الآن نحن في منطقة المنتجات ✅
    RAISE NOTICE '📝 معالجة سطر المنتج %: %', v_current_index, v_line;
    
    BEGIN
      -- إعادة تعيين المتغيرات لكل سطر
      v_product_name := NULL;
      v_color_name := NULL;
      v_size_name := NULL;
      v_quantity := 1;
      v_found_product := NULL;
      v_found_color := NULL;
      v_found_size := NULL;
      v_smart_alternatives := '';
      v_error_message := '';
      
      -- ✨ البحث عن المنتج
      SELECT p.id, p.name, p.price
      INTO v_found_product
      FROM products p
      WHERE p.is_active = true
        AND (
          lower(v_line) LIKE '%' || lower(p.name) || '%'
          OR lower(p.name) LIKE '%' || lower(v_line) || '%'
        )
      ORDER BY 
        CASE 
          WHEN lower(v_line) = lower(p.name) THEN 1
          WHEN lower(v_line) LIKE lower(p.name) || '%' THEN 2
          WHEN lower(v_line) LIKE '%' || lower(p.name) THEN 3
          ELSE 4
        END,
        length(p.name) ASC
      LIMIT 1;

      -- إذا لم نجد منتج، نتجاهل السطر ونستمر
      IF v_found_product.id IS NULL THEN
        RAISE NOTICE '⚠️ لم يتم العثور على منتج في السطر: %', v_line;
        CONTINUE;
      END IF;

      RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_found_product.name, v_found_product.id;

      -- ✨ البحث عن اللون
      SELECT c.id, c.name
      INTO v_found_color
      FROM colors c
      WHERE lower(v_line) LIKE '%' || lower(c.name) || '%'
      ORDER BY length(c.name) DESC
      LIMIT 1;

      -- ✨ البحث عن الحجم
      SELECT s.id, s.name
      INTO v_found_size
      FROM sizes s
      WHERE lower(v_line) ~* lower(s.name)
      ORDER BY length(s.name) DESC
      LIMIT 1;

      -- ✨ البحث عن الكمية
      IF v_line ~ '\d+' THEN
        v_quantity := COALESCE((regexp_match(v_line, '(\d+)'))[1]::integer, 1);
      END IF;

      -- ✨ معالجة حالة: اللون أو الحجم غير محدد
      IF v_found_color.id IS NULL OR v_found_size.id IS NULL THEN
        RAISE NOTICE '⚠️ اللون أو الحجم غير محدد - سيتم إضافة عنصر فاشل';
        
        -- بناء البدائل المتوفرة
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
                WHEN 'XXXL' THEN 7
                ELSE 8
              END
            ) as sizes
          FROM available_variants
          GROUP BY color_name
          ORDER BY color_name
        )
        SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
        INTO v_smart_alternatives
        FROM color_sizes;

        v_error_message := format(
          E'❌ السطر "%s"\n\nالمنتج: %s\nالمشكلة: %s\n\n✅ البدائل المتوفرة:\n%s',
          v_line,
          v_found_product.name,
          CASE 
            WHEN v_found_color.id IS NULL AND v_found_size.id IS NULL THEN 'اللون والحجم غير محددين'
            WHEN v_found_color.id IS NULL THEN 'اللون غير محدد'
            ELSE 'الحجم غير محدد'
          END,
          COALESCE(v_smart_alternatives, 'لا توجد متغيرات متوفرة حالياً')
        );
        
        -- ✅ إضافة عنصر فاشل مع is_available: false
        v_item := jsonb_build_object(
          'product_id', v_found_product.id,
          'product_name', v_found_product.name,
          'variant_id', NULL,
          'color_name', COALESCE(v_found_color.name, 'غير محدد'),
          'size_name', COALESCE(v_found_size.name, 'غير محدد'),
          'quantity', v_quantity,
          'price', v_found_product.price,
          'is_available', false,
          'alternatives_message', v_error_message
        );
        
        v_items := v_items || jsonb_build_array(v_item);
        RAISE NOTICE '⚠️ تم إضافة عنصر فاشل: %', v_error_message;
        CONTINUE;
      END IF;

      -- ✨ البحث عن المتغير
      SELECT pv.id, COALESCE(i.quantity - i.reserved_quantity, 0), pv.price
      INTO v_variant_id, v_available_quantity, v_price
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product.id
        AND pv.color_id = v_found_color.id
        AND pv.size_id = v_found_size.id
      LIMIT 1;

      -- معالجة حالة: المتغير غير موجود
      IF v_variant_id IS NULL THEN
        RAISE NOTICE '⚠️ المتغير غير موجود - سيتم إضافة عنصر فاشل';
        
        -- بناء البدائل
        WITH available_variants AS (
          SELECT DISTINCT 
            c.name as color_name,
            s.name as size_name
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
                WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
                WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6
                WHEN 'XXXL' THEN 7 ELSE 8
              END
            ) as sizes
          FROM available_variants
          GROUP BY color_name
          ORDER BY color_name
        )
        SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
        INTO v_smart_alternatives
        FROM color_sizes;

        v_error_message := format(
          E'❌ السطر "%s"\n\nالمنتج: %s\nاللون: %s\nالحجم: %s\nالمشكلة: هذا المتغير غير موجود\n\n✅ البدائل المتوفرة:\n%s',
          v_line,
          v_found_product.name,
          v_found_color.name,
          v_found_size.name,
          COALESCE(v_smart_alternatives, 'لا توجد متغيرات متوفرة حالياً')
        );
        
        -- ✅ إضافة عنصر فاشل
        v_item := jsonb_build_object(
          'product_id', v_found_product.id,
          'product_name', v_found_product.name,
          'variant_id', NULL,
          'color_name', v_found_color.name,
          'size_name', v_found_size.name,
          'quantity', v_quantity,
          'price', v_found_product.price,
          'is_available', false,
          'alternatives_message', v_error_message
        );
        
        v_items := v_items || jsonb_build_array(v_item);
        RAISE NOTICE '⚠️ تم إضافة عنصر فاشل: %', v_error_message;
        CONTINUE;
      END IF;

      -- معالجة حالة: الكمية غير كافية
      IF v_available_quantity < v_quantity THEN
        RAISE NOTICE '⚠️ الكمية غير كافية (%/%) - سيتم إضافة عنصر فاشل', v_available_quantity, v_quantity;
        
        -- بناء البدائل
        WITH available_variants AS (
          SELECT DISTINCT 
            c.name as color_name,
            s.name as size_name
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
            string_agg(size_name, ', ') as sizes
          FROM available_variants
          GROUP BY color_name
          ORDER BY color_name
        )
        SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
        INTO v_smart_alternatives
        FROM color_sizes;

        v_error_message := format(
          E'❌ السطر "%s"\n\nالمنتج: %s %s %s\nالمشكلة: الكمية المتوفرة هي %s فقط (طلبت %s)\n\n✅ البدائل المتوفرة:\n%s',
          v_line,
          v_found_product.name,
          v_found_color.name,
          v_found_size.name,
          v_available_quantity,
          v_quantity,
          COALESCE(v_smart_alternatives, 'لا توجد متغيرات متوفرة حالياً')
        );
        
        -- ✅ إضافة عنصر فاشل
        v_item := jsonb_build_object(
          'product_id', v_found_product.id,
          'product_name', v_found_product.name,
          'variant_id', v_variant_id,
          'color_name', v_found_color.name,
          'size_name', v_found_size.name,
          'quantity', v_quantity,
          'price', COALESCE(v_price, v_found_product.price),
          'is_available', false,
          'alternatives_message', v_error_message
        );
        
        v_items := v_items || jsonb_build_array(v_item);
        RAISE NOTICE '⚠️ تم إضافة عنصر فاشل: %', v_error_message;
        CONTINUE;
      END IF;

      -- ✅ المنتج صالح - أضفه للقائمة مع is_available: true
      v_item := jsonb_build_object(
        'product_id', v_found_product.id,
        'product_name', v_found_product.name,
        'variant_id', v_variant_id,
        'color_name', v_found_color.name,
        'size_name', v_found_size.name,
        'quantity', v_quantity,
        'price', COALESCE(v_price, v_found_product.price),
        'is_available', true
      );

      v_items := v_items || jsonb_build_array(v_item);
      
      RAISE NOTICE '✅ تم إضافة عنصر ناجح: % % % × %', v_found_product.name, v_found_color.name, v_found_size.name, v_quantity;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ خطأ في معالجة السطر "%": SQLSTATE=%, SQLERRM=%', 
          v_line, SQLSTATE, SQLERRM;
        
        -- ✅ إضافة عنصر فاشل للأخطاء غير المتوقعة
        v_item := jsonb_build_object(
          'product_id', NULL,
          'product_name', 'خطأ',
          'variant_id', NULL,
          'color_name', 'غير محدد',
          'size_name', 'غير محدد',
          'quantity', 1,
          'price', 0,
          'is_available', false,
          'alternatives_message', format('خطأ غير متوقع: %s', SQLERRM)
        );
        v_items := v_items || jsonb_build_array(v_item);
        CONTINUE;
    END;
  END LOOP;

  -- ✅ إرجاع المصفوفة مباشرة (بدون wrapper object)
  RAISE NOTICE '📊 النتيجة النهائية: % عناصر', jsonb_array_length(v_items);
  RETURN v_items;
END;
$function$;