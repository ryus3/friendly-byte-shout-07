-- ✅ إضافة دعم المنتجات ذات الكلمتين (مع الحفاظ على البحث عن كلمة واحدة)
-- النسخة الاحتياطية موجودة في: 20251019181404_remote_schema.sql

CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(input_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_words text[];
  v_word text;
  v_word_index integer;
  v_product_id uuid;
  v_product_name text;
  v_color text;
  v_size text;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_total numeric := 0;
BEGIN
  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(input_text, E'\n');
  
  -- معالجة كل سطر
  FOREACH v_line IN ARRAY v_lines LOOP
    -- تجاهل الأسطر الفارغة
    CONTINUE WHEN trim(v_line) = '';
    
    -- تقسيم السطر إلى كلمات
    v_words := regexp_split_to_array(trim(v_line), E'\\s+');
    
    -- تهيئة المتغيرات لكل سطر
    v_product_id := NULL;
    v_product_name := NULL;
    v_color := NULL;
    v_size := NULL;
    
    -- البحث عن المنتج (دعم كلمة واحدة وكلمتين)
    FOR v_word_index IN 1..array_length(v_words, 1) LOOP
      v_word := v_words[v_word_index];
      
      -- محاولة 1: البحث عن منتج بكلمتين (إذا كان هناك كلمة تالية)
      IF v_word_index < array_length(v_words, 1) THEN
        SELECT id, name INTO v_product_id, v_product_name
        FROM products
        WHERE lower(name) = lower(v_word || ' ' || v_words[v_word_index + 1])
        LIMIT 1;
        
        -- إذا وجدنا منتج بكلمتين، نتخطى الكلمة التالية
        IF v_product_id IS NOT NULL THEN
          v_word_index := v_word_index + 1;
          EXIT;
        END IF;
      END IF;
      
      -- محاولة 2: البحث عن منتج بكلمة واحدة
      IF v_product_id IS NULL THEN
        SELECT id, name INTO v_product_id, v_product_name
        FROM products
        WHERE lower(name) = lower(v_word)
        LIMIT 1;
        
        EXIT WHEN v_product_id IS NOT NULL;
      END IF;
    END LOOP;
    
    -- إذا لم نجد منتج، نتخطى هذا السطر
    CONTINUE WHEN v_product_id IS NULL;
    
    -- البحث عن اللون والحجم في بقية الكلمات
    FOREACH v_word IN ARRAY v_words LOOP
      -- تجاهل اسم المنتج نفسه
      CONTINUE WHEN lower(v_word) = lower(v_product_name);
      
      -- البحث عن اللون
      IF v_color IS NULL THEN
        SELECT name INTO v_color
        FROM colors
        WHERE lower(name) = lower(v_word)
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
    
    -- إنشاء عنصر المنتج
    v_item := jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'color', v_color,
      'size', v_size,
      'quantity', 1
    );
    
    -- إضافة العنصر إلى القائمة
    v_items := v_items || v_item;
    
    -- حساب الإجمالي
    SELECT COALESCE(price, 0) INTO v_total
    FROM products
    WHERE id = v_product_id;
  END LOOP;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total
  );
END;
$function$;