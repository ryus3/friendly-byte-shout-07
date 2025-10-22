-- استعادة الدالة الصحيحة + إضافة دعم المنتجات ذات الكلمتين بأمان
-- إصلاح الدالة المعطلة من Migration السابق

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
  v_word_index integer;
  v_product_id uuid;
  v_product_name text;
  v_color text;
  v_size text;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_variant_id uuid;
  v_variant_price numeric;
  v_total numeric := 0;
BEGIN
  -- تقسيم النص على علامة + (الفاصل بين المنتجات)
  v_parts := string_to_array(input_text, '+');
  
  -- معالجة كل جزء (منتج)
  FOREACH v_part IN ARRAY v_parts LOOP
    -- تجاهل الأجزاء الفارغة
    CONTINUE WHEN trim(v_part) = '';
    
    -- تقسيم الجزء إلى كلمات
    v_words := regexp_split_to_array(trim(v_part), E'\\s+');
    
    -- تهيئة المتغيرات
    v_product_id := NULL;
    v_product_name := NULL;
    v_color := NULL;
    v_size := NULL;
    v_variant_id := NULL;
    v_variant_price := NULL;
    
    -- 🔹 البحث عن المنتج (دعم كلمة واحدة وكلمتين)
    v_word_index := 1;
    WHILE v_word_index <= array_length(v_words, 1) LOOP
      v_word := v_words[v_word_index];
      
      -- تجاهل الأرقام (أرقام الهاتف مثلاً)
      IF v_word ~ '^\d+$' THEN
        v_word_index := v_word_index + 1;
        CONTINUE;
      END IF;
      
      -- محاولة 1: البحث عن منتج بكلمتين متتاليتين
      IF v_word_index < array_length(v_words, 1) THEN
        SELECT id, name INTO v_product_id, v_product_name
        FROM products
        WHERE lower(name) = lower(v_word || ' ' || v_words[v_word_index + 1])
        LIMIT 1;
        
        -- إذا وجدنا منتج بكلمتين، نتخطى الكلمة التالية ونخرج
        IF v_product_id IS NOT NULL THEN
          v_word_index := v_word_index + 1;
          EXIT;
        END IF;
      END IF;
      
      -- محاولة 2: البحث عن منتج بكلمة واحدة (LIKE للمرونة)
      IF v_product_id IS NULL THEN
        SELECT id, name INTO v_product_id, v_product_name
        FROM products
        WHERE lower(name) LIKE '%' || lower(v_word) || '%'
        LIMIT 1;
        
        IF v_product_id IS NOT NULL THEN
          EXIT;
        END IF;
      END IF;
      
      v_word_index := v_word_index + 1;
    END LOOP;
    
    -- إذا لم نجد منتج، نتخطى هذا الجزء
    CONTINUE WHEN v_product_id IS NULL;
    
    -- البحث عن اللون والحجم
    FOREACH v_word IN ARRAY v_words LOOP
      -- تجاهل الأرقام
      CONTINUE WHEN v_word ~ '^\d+$';
      
      -- تجاهل كلمات اسم المنتج
      CONTINUE WHEN position(lower(v_word) IN lower(v_product_name)) > 0;
      
      -- البحث عن اللون
      IF v_color IS NULL THEN
        SELECT name INTO v_color
        FROM colors
        WHERE lower(name) LIKE '%' || lower(v_word) || '%'
        LIMIT 1;
      END IF;
      
      -- البحث عن الحجم
      IF v_size IS NULL THEN
        SELECT name INTO v_size
        FROM sizes
        WHERE lower(name) = lower(v_word)
        LIMIT 1;
      END IF;
    END LOOP;
    
    -- البحث عن variant المطابق
    IF v_color IS NOT NULL AND v_size IS NOT NULL THEN
      SELECT pv.id, pv.price INTO v_variant_id, v_variant_price
      FROM product_variants pv
      WHERE pv.product_id = v_product_id
        AND lower(pv.color) = lower(v_color)
        AND lower(pv.size) = lower(v_size)
      LIMIT 1;
    END IF;
    
    -- إذا لم نجد variant، نستخدم أول variant متاح
    IF v_variant_id IS NULL THEN
      SELECT pv.id, pv.price, pv.color, pv.size 
      INTO v_variant_id, v_variant_price, v_color, v_size
      FROM product_variants pv
      WHERE pv.product_id = v_product_id
      LIMIT 1;
    END IF;
    
    -- إنشاء عنصر المنتج
    v_item := jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'variant_id', v_variant_id,
      'color', v_color,
      'size', v_size,
      'quantity', 1,
      'price', COALESCE(v_variant_price, 0)
    );
    
    -- إضافة العنصر إلى القائمة
    v_items := v_items || v_item;
    
    -- حساب الإجمالي
    v_total := v_total + COALESCE(v_variant_price, 0);
  END LOOP;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total
  );
END;
$function$;