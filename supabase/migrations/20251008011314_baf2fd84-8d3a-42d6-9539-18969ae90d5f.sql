-- حذف النسخة الخاطئة من extract_product_items_from_text
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(TEXT, UUID);

-- إعادة إنشاء extract_product_items_from_text بالنسخة الصحيحة
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result JSONB := '[]'::JSONB;
  v_lines TEXT[];
  v_line TEXT;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
  v_quantity INTEGER;
  v_product RECORD;
  v_variant RECORD;
  v_item JSONB;
  v_alternatives JSONB;
  v_alternatives_message TEXT;
BEGIN
  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(input_text, E'\n');
  
  -- معالجة كل سطر
  FOREACH v_line IN ARRAY v_lines
  LOOP
    -- تنظيف السطر
    v_line := TRIM(v_line);
    
    -- تخطي الأسطر الفارغة أو التي لا تبدأ برقم
    CONTINUE WHEN v_line = '' OR v_line !~ '^\d+';
    
    -- استخراج المعلومات من السطر
    -- التنسيق المتوقع: "الكمية اسم_المنتج اللون المقاس"
    v_quantity := NULLIF(SPLIT_PART(v_line, ' ', 1), '')::INTEGER;
    v_product_name := TRIM(SPLIT_PART(v_line, ' ', 2));
    v_color_name := TRIM(SPLIT_PART(v_line, ' ', 3));
    v_size_name := TRIM(SPLIT_PART(v_line, ' ', 4));
    
    -- البحث عن المنتج
    SELECT * INTO v_product
    FROM products p
    WHERE LOWER(p.name) LIKE '%' || LOWER(v_product_name) || '%'
    LIMIT 1;
    
    IF v_product.id IS NULL THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المتغير (variant)
    SELECT 
      pv.*,
      c.name as color_name,
      s.name as size_name,
      pv.price
    INTO v_variant
    FROM product_variants pv
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    WHERE pv.product_id = v_product.id
      AND (v_color_name = '' OR LOWER(c.name) = LOWER(v_color_name))
      AND (v_size_name = '' OR LOWER(s.name) = LOWER(v_size_name))
      AND pv.quantity >= v_quantity
    ORDER BY pv.quantity DESC
    LIMIT 1;
    
    IF v_variant.id IS NOT NULL THEN
      -- المنتج متوفر
      v_item := jsonb_build_object(
        'product_id', v_product.id,
        'variant_id', v_variant.id,
        'product_name', v_product.name,
        'color', v_variant.color_name,
        'size', v_variant.size_name,
        'quantity', v_quantity,
        'price', v_variant.price,
        'total_price', v_variant.price * v_quantity,
        'is_available', true
      );
    ELSE
      -- البحث عن بدائل متوفرة
      SELECT jsonb_agg(
        jsonb_build_object(
          'variant_id', pv.id,
          'color', c.name,
          'size', s.name,
          'available_quantity', pv.quantity,
          'price', pv.price
        )
      ) INTO v_alternatives
      FROM product_variants pv
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_product.id
        AND pv.quantity > 0
      ORDER BY pv.quantity DESC
      LIMIT 5;
      
      v_alternatives_message := '❌ المنتج ' || v_product.name || ' (' || v_color_name || ' - ' || v_size_name || ') غير متوفر بالكمية المطلوبة';
      
      IF v_alternatives IS NOT NULL THEN
        v_alternatives_message := v_alternatives_message || E'\n\n📦 بدائل متوفرة:';
      END IF;
      
      v_item := jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'requested_color', v_color_name,
        'requested_size', v_size_name,
        'requested_quantity', v_quantity,
        'is_available', false,
        'alternatives', COALESCE(v_alternatives, '[]'::JSONB),
        'alternatives_message', v_alternatives_message
      );
    END IF;
    
    -- إضافة العنصر إلى النتيجة
    v_result := v_result || v_item;
  END LOOP;
  
  RETURN v_result;
END;
$function$;