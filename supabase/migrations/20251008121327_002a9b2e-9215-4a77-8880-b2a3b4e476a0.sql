-- حذف الدالة القديمة أولاً
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

-- إعادة إنشاء الدالة مع الإصلاح الجذري لإعادة الذكاء
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
  
  v_lines := string_to_array(p_message_text, E'\n');
  
  FOREACH v_line IN ARRAY v_lines
  LOOP
    v_line := TRIM(v_line);
    
    IF v_line = '' OR v_line ~* '^07[0-9]{9}$' OR v_line ~* '^(بغداد|البصرة|النجف|كربلاء|الموصل|اربيل|السليمانية|ديالى|الانبار|صلاح الدين|واسط|ميسان|ذي قار|القادسية|المثنى|بابل|كركوك|دهوك)' THEN
      RAISE NOTICE '⏭️ تجاهل السطر (عنوان/هاتف): %', v_line;
      CONTINUE;
    END IF;

    RAISE NOTICE '📝 معالجة السطر: %', v_line;
    
    BEGIN
      v_product_name := NULL;
      v_color_name := NULL;
      v_size_name := NULL;
      v_quantity := 1;
      v_found_product := NULL;
      v_found_color := NULL;
      v_found_size := NULL;
      v_smart_alternatives := '';
      
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

      IF v_found_product.id IS NULL THEN
        RAISE NOTICE '⚠️ لم يتم العثور على منتج في السطر: %', v_line;
        CONTINUE;
      END IF;

      RAISE NOTICE '✅ تم العثور على المنتج: % (ID: %)', v_found_product.name, v_found_product.id;

      SELECT c.id, c.name
      INTO v_found_color
      FROM colors c
      WHERE lower(v_line) LIKE '%' || lower(c.name) || '%'
      ORDER BY length(c.name) DESC
      LIMIT 1;

      SELECT s.id, s.name
      INTO v_found_size
      FROM sizes s
      WHERE lower(v_line) ~* lower(s.name)
      ORDER BY length(s.name) DESC
      LIMIT 1;

      IF v_line ~ '\d+' THEN
        v_quantity := COALESCE((regexp_match(v_line, '(\d+)'))[1]::integer, 1);
      END IF;

      IF v_found_color.id IS NULL OR v_found_size.id IS NULL THEN
        RAISE NOTICE '⚠️ اللون أو الحجم غير محدد - بناء رسالة البدائل الذكية';
        
        -- ✨ الإصلاح: فحص وجود المنتج قبل بناء البدائل
        IF v_found_product.id IS NOT NULL THEN
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
              color_id,
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
            GROUP BY color_name, color_id
            ORDER BY color_name
          )
          SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
          INTO v_smart_alternatives
          FROM color_sizes;
        END IF;

        v_error_message := format(
          E'❌ لم يتم إنشاء طلب!\nالمنتج "%s" اللون "%s" غير متوفر\n\n✅ الألوان والأحجام المتوفرة:\n%s',
          v_found_product.name,
          COALESCE(v_found_color.name, 'غير محدد'),
          COALESCE(v_smart_alternatives, 'لا توجد متغيرات متوفرة حالياً')
        );
        
        RAISE NOTICE '🚫 %', v_error_message;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', v_error_message,
          'items', '[]'::jsonb
        );
      END IF;

      SELECT pv.id, COALESCE(i.quantity - i.reserved_quantity, 0), pv.price
      INTO v_variant_id, v_available_quantity, v_price
      FROM product_variants pv
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_found_product.id
        AND pv.color_id = v_found_color.id
        AND pv.size_id = v_found_size.id
      LIMIT 1;

      IF v_variant_id IS NULL THEN
        RAISE NOTICE '⚠️ المتغير غير موجود - بناء رسالة البدائل';
        
        IF v_found_product.id IS NOT NULL THEN
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
              color_id,
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
            GROUP BY color_name, color_id
            ORDER BY color_name
          )
          SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
          INTO v_smart_alternatives
          FROM color_sizes;
        END IF;

        v_error_message := format(
          E'❌ لم يتم إنشاء طلب!\nالمنتج "%s" اللون "%s" الحجم "%s" غير متوفر\n\n✅ الألوان والأحجام المتوفرة:\n%s',
          v_found_product.name,
          v_found_color.name,
          v_found_size.name,
          COALESCE(v_smart_alternatives, 'لا توجد متغيرات متوفرة حالياً')
        );
        
        RAISE NOTICE '🚫 %', v_error_message;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', v_error_message,
          'items', '[]'::jsonb
        );
      END IF;

      IF v_available_quantity < v_quantity THEN
        RAISE NOTICE '⚠️ الكمية غير كافية (%/%) - بناء رسالة البدائل', v_available_quantity, v_quantity;
        
        IF v_found_product.id IS NOT NULL THEN
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
              color_id,
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
            GROUP BY color_name, color_id
            ORDER BY color_name
          )
          SELECT string_agg('• ' || color_name || ' : ' || sizes, E'\n')
          INTO v_smart_alternatives
          FROM color_sizes;
        END IF;

        v_error_message := format(
          E'❌ لم يتم إنشاء طلب!\nالكمية المتوفرة من "%s %s %s" هي %s فقط\n\n✅ الألوان والأحجام المتوفرة:\n%s',
          v_found_product.name,
          v_found_color.name,
          v_found_size.name,
          v_available_quantity,
          COALESCE(v_smart_alternatives, 'لا توجد متغيرات متوفرة حالياً')
        );
        
        RAISE NOTICE '🚫 %', v_error_message;
        
        RETURN jsonb_build_object(
          'success', false,
          'error', v_error_message,
          'items', '[]'::jsonb
        );
      END IF;

      v_item := jsonb_build_object(
        'product_id', v_found_product.id,
        'product_name', v_found_product.name,
        'variant_id', v_variant_id,
        'color_name', v_found_color.name,
        'size_name', v_found_size.name,
        'quantity', v_quantity,
        'price', COALESCE(v_price, v_found_product.price)
      );

      v_items := v_items || v_item;
      
      RAISE NOTICE '✅ تم إضافة عنصر: % % % × %', v_found_product.name, v_found_color.name, v_found_size.name, v_quantity;

    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '❌ خطأ في معالجة السطر "%": SQLSTATE=%, SQLERRM=%', 
          v_line, SQLSTATE, SQLERRM;
        CONTINUE;
    END;
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE NOTICE '⚠️ لم يتم استخراج أي منتجات';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على منتجات صالحة في الرسالة',
      'items', '[]'::jsonb
    );
  END IF;

  RAISE NOTICE '✅ تم استخراج % منتج بنجاح', jsonb_array_length(v_items);
  
  RETURN jsonb_build_object(
    'success', true,
    'items', v_items
  );
END;
$function$;