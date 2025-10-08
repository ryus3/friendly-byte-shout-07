-- حذف الدالة القديمة بالتوقيع الصحيح
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

-- إعادة إنشاء الدالة مع استخدام base_price بدلاً من price
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(p_input_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_product_name text;
  v_color_name text;
  v_size_name text;
  v_quantity integer;
  v_result jsonb := '[]'::jsonb;
  v_found_product RECORD;
  v_variant_id uuid;
  v_stock_quantity integer;
  v_price numeric;
  v_phone text;
  v_item jsonb;
  v_cleaned_line text;
BEGIN
  -- تنظيف النص وتقسيمه إلى أسطر
  v_lines := string_to_array(trim(p_input_text), E'\n');
  
  -- استخراج رقم الهاتف من النص بالكامل
  v_phone := extractphonefromtext(p_input_text);
  
  -- معالجة كل سطر
  FOREACH v_line IN ARRAY v_lines LOOP
    -- تجاهل الأسطر الفارغة أو التي تحتوي على رقم الهاتف فقط
    v_cleaned_line := trim(v_line);
    IF v_cleaned_line = '' OR v_cleaned_line = v_phone THEN
      CONTINUE;
    END IF;
    
    -- تجاهل الأسطر التي تحتوي على معلومات العنوان/الموقع
    IF v_cleaned_line ~* 'قرب|محافظة|مدينة|منطقة|حي|شارع' THEN
      CONTINUE;
    END IF;
    
    -- محاولة استخراج الكمية من بداية السطر
    v_quantity := 1; -- القيمة الافتراضية
    IF v_cleaned_line ~ '^\d+' THEN
      v_quantity := substring(v_cleaned_line from '^\d+')::integer;
      v_cleaned_line := trim(regexp_replace(v_cleaned_line, '^\d+\s*', ''));
    END IF;
    
    -- تنظيف السطر من الرموز الخاصة
    v_cleaned_line := regexp_replace(v_cleaned_line, '[*×x]', ' ', 'g');
    v_cleaned_line := trim(v_cleaned_line);
    
    -- محاولة استخراج اسم المنتج واللون والحجم
    -- البحث عن المنتج في قاعدة البيانات
    SELECT p.id, p.name, p.base_price
    INTO v_found_product
    FROM products p
    WHERE similarity(p.name, v_cleaned_line) > 0.3
    ORDER BY similarity(p.name, v_cleaned_line) DESC
    LIMIT 1;
    
    IF v_found_product.id IS NULL THEN
      -- لم يتم العثور على منتج مطابق
      CONTINUE;
    END IF;
    
    -- استخراج اللون والحجم من النص
    v_color_name := NULL;
    v_size_name := NULL;
    
    -- البحث عن اللون
    SELECT c.name INTO v_color_name
    FROM colors c
    WHERE v_cleaned_line ILIKE '%' || c.name || '%'
    LIMIT 1;
    
    -- البحث عن الحجم
    SELECT s.name INTO v_size_name
    FROM sizes s
    WHERE v_cleaned_line ILIKE '%' || s.name || '%'
    LIMIT 1;
    
    -- البحث عن المتغير المناسب
    v_variant_id := NULL;
    v_stock_quantity := 0;
    v_price := NULL;
    
    IF v_color_name IS NOT NULL AND v_size_name IS NOT NULL THEN
      -- البحث عن متغير بلون وحجم محددين
      SELECT pv.id, pv.stock_quantity, pv.price
      INTO v_variant_id, v_stock_quantity, v_price
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_found_product.id
        AND c.name = v_color_name
        AND s.name = v_size_name
      LIMIT 1;
      
      IF v_variant_id IS NOT NULL THEN
        -- تم العثور على المتغير
        IF v_stock_quantity >= v_quantity THEN
          -- المخزون كافي
          v_item := jsonb_build_object(
            'product_id', v_found_product.id,
            'product_name', v_found_product.name,
            'color', v_color_name,
            'size', v_size_name,
            'quantity', v_quantity,
            'price', COALESCE(v_price, v_found_product.base_price),
            'variant_id', v_variant_id,
            'is_available', true
          );
        ELSE
          -- المخزون غير كافي
          v_item := jsonb_build_object(
            'product_id', v_found_product.id,
            'product_name', v_found_product.name,
            'color', v_color_name,
            'size', v_size_name,
            'quantity', v_quantity,
            'price', COALESCE(v_price, v_found_product.base_price),
            'variant_id', v_variant_id,
            'is_available', false,
            'reason', 'الكمية المتوفرة: ' || v_stock_quantity
          );
        END IF;
        v_result := v_result || v_item;
        CONTINUE;
      END IF;
    END IF;
    
    IF v_color_name IS NOT NULL THEN
      -- البحث عن متغير بلون محدد فقط
      SELECT pv.id, pv.stock_quantity, pv.price, s.name
      INTO v_variant_id, v_stock_quantity, v_price, v_size_name
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_found_product.id
        AND c.name = v_color_name
      ORDER BY pv.stock_quantity DESC
      LIMIT 1;
      
      IF v_variant_id IS NOT NULL THEN
        IF v_stock_quantity >= v_quantity THEN
          v_item := jsonb_build_object(
            'product_id', v_found_product.id,
            'product_name', v_found_product.name,
            'color', v_color_name,
            'size', v_size_name,
            'quantity', v_quantity,
            'price', COALESCE(v_price, v_found_product.base_price),
            'variant_id', v_variant_id,
            'is_available', true
          );
        ELSE
          v_item := jsonb_build_object(
            'product_id', v_found_product.id,
            'product_name', v_found_product.name,
            'color', v_color_name,
            'size', v_size_name,
            'quantity', v_quantity,
            'price', COALESCE(v_price, v_found_product.base_price),
            'variant_id', v_variant_id,
            'is_available', false,
            'reason', 'الكمية المتوفرة: ' || v_stock_quantity
          );
        END IF;
        v_result := v_result || v_item;
        CONTINUE;
      END IF;
    END IF;
    
    IF v_size_name IS NOT NULL THEN
      -- البحث عن متغير بحجم محدد فقط
      SELECT pv.id, pv.stock_quantity, pv.price, c.name
      INTO v_variant_id, v_stock_quantity, v_price, v_color_name
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      WHERE pv.product_id = v_found_product.id
        AND s.name = v_size_name
      ORDER BY pv.stock_quantity DESC
      LIMIT 1;
      
      IF v_variant_id IS NOT NULL THEN
        IF v_stock_quantity >= v_quantity THEN
          v_item := jsonb_build_object(
            'product_id', v_found_product.id,
            'product_name', v_found_product.name,
            'color', v_color_name,
            'size', v_size_name,
            'quantity', v_quantity,
            'price', COALESCE(v_price, v_found_product.base_price),
            'variant_id', v_variant_id,
            'is_available', true
          );
        ELSE
          v_item := jsonb_build_object(
            'product_id', v_found_product.id,
            'product_name', v_found_product.name,
            'color', v_color_name,
            'size', v_size_name,
            'quantity', v_quantity,
            'price', COALESCE(v_price, v_found_product.base_price),
            'variant_id', v_variant_id,
            'is_available', false,
            'reason', 'الكمية المتوفرة: ' || v_stock_quantity
          );
        END IF;
        v_result := v_result || v_item;
        CONTINUE;
      END IF;
    END IF;
    
    -- البحث عن أي متغير متوفر
    SELECT pv.id, pv.stock_quantity, pv.price, c.name, s.name
    INTO v_variant_id, v_stock_quantity, v_price, v_color_name, v_size_name
    FROM product_variants pv
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes s ON pv.size_id = s.id
    WHERE pv.product_id = v_found_product.id
    ORDER BY pv.stock_quantity DESC
    LIMIT 1;
    
    IF v_variant_id IS NOT NULL THEN
      IF v_stock_quantity >= v_quantity THEN
        v_item := jsonb_build_object(
          'product_id', v_found_product.id,
          'product_name', v_found_product.name,
          'color', v_color_name,
          'size', v_size_name,
          'quantity', v_quantity,
          'price', COALESCE(v_price, v_found_product.base_price),
          'variant_id', v_variant_id,
          'is_available', true
        );
      ELSE
        v_item := jsonb_build_object(
          'product_id', v_found_product.id,
          'product_name', v_found_product.name,
          'color', v_color_name,
          'size', v_size_name,
          'quantity', v_quantity,
          'price', COALESCE(v_price, v_found_product.base_price),
          'variant_id', v_variant_id,
          'is_available', false,
          'reason', 'الكمية المتوفرة: ' || v_stock_quantity
        );
      END IF;
      v_result := v_result || v_item;
    ELSE
      -- لا يوجد متغير متوفر للمنتج
      v_item := jsonb_build_object(
        'product_id', v_found_product.id,
        'product_name', v_found_product.name,
        'color', NULL,
        'size', NULL,
        'quantity', v_quantity,
        'price', v_found_product.base_price,
        'variant_id', NULL,
        'is_available', false,
        'reason', 'المتغير المطلوب غير متوفر'
      );
      v_result := v_result || v_item;
    END IF;
  END LOOP;
  
  RETURN v_result;
END;
$function$;