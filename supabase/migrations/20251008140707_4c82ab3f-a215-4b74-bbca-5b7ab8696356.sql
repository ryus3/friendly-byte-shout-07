-- تحديث دالة extract_product_items_from_text لدعم أنماط متعددة (مع إصلاح مشكلة المتغيرات)
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(
  input_text TEXT,
  p_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_items JSONB := '[]'::jsonb;
  v_line TEXT;
  v_lines TEXT[];
  v_quantity INTEGER;
  v_product_text TEXT;
  v_product_name TEXT;
  v_color_name TEXT;
  v_size_name TEXT;
  v_variant_id UUID;
  v_alternative_message TEXT;
  v_item JSONB;
  v_words TEXT[];
  v_word TEXT;
  v_temp_name TEXT := '';
  v_temp_color TEXT := '';
  v_temp_size TEXT := '';
BEGIN
  -- تقسيم النص إلى سطور (دعم \n و ,)
  v_lines := string_to_array(regexp_replace(input_text, ',', E'\n', 'g'), E'\n');
  
  -- معالجة كل سطر
  FOREACH v_line IN ARRAY v_lines
  LOOP
    v_line := TRIM(v_line);
    
    -- تجاهل الأسطر الفارغة
    IF v_line = '' OR v_line IS NULL THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تبدو كأرقام هواتف أو عناوين
    IF v_line ~ '^\d{11}$' OR v_line ~ '^07\d{9}$' OR v_line ~ 'عنوان|ملاحظة|توصيل' THEN
      CONTINUE;
    END IF;
    
    -- استخراج الكمية
    v_quantity := 1; -- الافتراضي
    v_product_text := v_line;
    
    -- البحث عن نمط +رقم أولاً
    IF v_line ~* '\+\s*(\d+)' THEN
      v_quantity := (regexp_match(v_line, '\+\s*(\d+)'))[1]::INTEGER;
      v_product_text := TRIM(regexp_replace(v_line, '\+\s*\d+', '', 'g'));
    -- البحث عن رقم في نهاية السطر (بدون +)
    ELSIF v_line ~ '\s+(\d+)\s*$' THEN
      v_quantity := (regexp_match(v_line, '\s+(\d+)\s*$'))[1]::INTEGER;
      v_product_text := TRIM(regexp_replace(v_line, '\s+\d+\s*$', '', 'g'));
    END IF;
    
    -- إذا كانت الكمية 0 أو سالبة، تجاهل السطر
    IF v_quantity <= 0 THEN
      CONTINUE;
    END IF;
    
    -- تقسيم نص المنتج إلى كلمات للبحث
    v_words := string_to_array(lower(v_product_text), ' ');
    v_temp_name := '';
    v_temp_color := '';
    v_temp_size := '';
    
    -- محاولة استخراج اسم المنتج واللون والحجم
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF v_word = '' THEN
        CONTINUE;
      END IF;
      
      -- التحقق من اللون
      IF EXISTS (SELECT 1 FROM colors WHERE lower(name) = v_word) THEN
        v_temp_color := v_word;
      -- التحقق من الحجم
      ELSIF EXISTS (SELECT 1 FROM sizes WHERE lower(name) = v_word) THEN
        v_temp_size := v_word;
      -- باقي الكلمات تعتبر جزء من اسم المنتج
      ELSE
        IF v_temp_name = '' THEN
          v_temp_name := v_word;
        ELSE
          v_temp_name := v_temp_name || ' ' || v_word;
        END IF;
      END IF;
    END LOOP;
    
    -- محاولة إيجاد المنتج
    v_product_name := NULL;
    v_color_name := NULL;
    v_size_name := NULL;
    v_variant_id := NULL;
    v_alternative_message := NULL;
    
    -- البحث الأساسي مع الصلاحيات
    SELECT 
      p.name,
      c.name,
      s.name,
      pv.id
    INTO 
      v_product_name,
      v_color_name,
      v_size_name,
      v_variant_id
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN colors c ON pv.color_id = c.id
    LEFT JOIN sizes s ON pv.size_id = s.id
    WHERE 
      (p_employee_id IS NULL OR check_user_product_access(
        p_employee_id,
        p.category_id,
        pv.color_id,
        pv.size_id,
        p.department_id,
        p.product_type_id,
        p.season_occasion_id
      ))
      AND lower(p.name) LIKE '%' || v_temp_name || '%'
      AND (v_temp_color = '' OR lower(c.name) = v_temp_color)
      AND (v_temp_size = '' OR lower(s.name) = v_temp_size)
      AND pv.quantity_in_stock > 0
    ORDER BY 
      CASE WHEN lower(p.name) = v_temp_name THEN 1 ELSE 2 END,
      pv.quantity_in_stock DESC
    LIMIT 1;
    
    -- إذا لم نجد، نبحث عن بدائل
    IF v_variant_id IS NULL THEN
      -- البحث عن نفس المنتج بلون مختلف
      SELECT 
        p.name,
        c.name,
        s.name,
        pv.id,
        'اللون ' || COALESCE(v_temp_color, 'المطلوب') || ' غير متوفر، تم اختيار ' || c.name || ' بدلاً منه'
      INTO 
        v_product_name,
        v_color_name,
        v_size_name,
        v_variant_id,
        v_alternative_message
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN colors c ON pv.color_id = c.id
      LEFT JOIN sizes s ON pv.size_id = s.id
      WHERE 
        (p_employee_id IS NULL OR check_user_product_access(
          p_employee_id,
          p.category_id,
          pv.color_id,
          pv.size_id,
          p.department_id,
          p.product_type_id,
          p.season_occasion_id
        ))
        AND lower(p.name) LIKE '%' || v_temp_name || '%'
        AND (v_temp_size = '' OR lower(s.name) = v_temp_size)
        AND pv.quantity_in_stock > 0
      ORDER BY pv.quantity_in_stock DESC
      LIMIT 1;
    END IF;
    
    -- إضافة العنصر إذا وجدنا تطابق
    IF v_variant_id IS NOT NULL THEN
      v_item := jsonb_build_object(
        'product_name', v_product_name,
        'color_name', COALESCE(v_color_name, 'افتراضي'),
        'size_name', COALESCE(v_size_name, 'افتراضي'),
        'quantity', v_quantity,
        'variant_id', v_variant_id,
        'alternative_message', v_alternative_message
      );
      v_items := v_items || v_item;
    END IF;
  END LOOP;
  
  RETURN v_items;
END;
$$;