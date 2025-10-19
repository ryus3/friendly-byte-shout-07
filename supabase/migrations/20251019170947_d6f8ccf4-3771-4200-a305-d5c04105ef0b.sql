-- استرجاع النسخة الذكية الأصلية من extract_product_items_from_text
-- تستخدم pv.price كما كانت في 8 أكتوبر 2024

DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

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
  v_best_match record;
  v_max_score numeric := 0;
  v_current_score numeric;
  v_product_name text;
  v_color_name text := 'افتراضي';
  v_size_name text := 'افتراضي';
  v_normalized_search text;
  v_color_id uuid;
  v_size_id uuid;
  v_temp_product_name text;
  v_temp_color text;
  v_temp_size text;
  v_last_product_name text := NULL;
  v_size_generalized boolean := false;
  v_previous_items jsonb := '[]';
  v_item jsonb;
  v_is_continuation boolean := false;
  v_color_keywords text[] := ARRAY['ازرق', 'احمر', 'اخضر', 'اصفر', 'اسود', 'ابيض', 'رمادي', 'بني', 'برتقالي', 'بنفسجي', 'وردي', 'بيج', 'كحلي', 'زيتي', 'سماوي', 'ذهبي', 'فضي', 'نيلي'];
  v_size_keywords text[] := ARRAY['سمول', 'ميديوم', 'لارج', 'اكس لارج', 'دبل اكس', 'تربل اكس', 'صغير', 'وسط', 'كبير', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'];
BEGIN
  -- تنظيف النص المدخل
  input_text := TRIM(BOTH FROM input_text);
  input_text := regexp_replace(input_text, '\s+', ' ', 'g');
  
  -- تقسيم النص إلى سطور
  v_lines := string_to_array(input_text, E'\n');
  
  FOREACH v_line IN ARRAY v_lines LOOP
    v_line := TRIM(v_line);
    IF v_line = '' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن علامة + للفصل بين المنتجات
    IF POSITION('+' IN v_line) > 0 THEN
      v_parts := string_to_array(v_line, '+');
    ELSE
      v_parts := ARRAY[v_line];
    END IF;
    
    FOREACH v_part IN ARRAY v_parts LOOP
      v_part := TRIM(v_part);
      IF v_part = '' THEN
        CONTINUE;
      END IF;
      
      -- تحليل الكلمات
      v_words := string_to_array(v_part, ' ');
      v_quantity := 1;
      v_product_name := '';
      v_color_name := 'افتراضي';
      v_size_name := 'افتراضي';
      v_is_continuation := false;
      
      FOREACH v_word IN ARRAY v_words LOOP
        v_word := TRIM(v_word);
        
        -- استخراج الكمية
        IF v_word ~ '^\d+$' AND v_product_name = '' THEN
          v_quantity := v_word::integer;
          CONTINUE;
        END IF;
        
        -- استخراج اللون
        IF v_word = ANY(v_color_keywords) THEN
          v_color_name := v_word;
          CONTINUE;
        END IF;
        
        -- استخراج الحجم
        IF v_word = ANY(v_size_keywords) THEN
          v_size_name := v_word;
          CONTINUE;
        END IF;
        
        -- إذا كان "نفسه" أو "نفس" -> استخدام المنتج السابق
        IF v_word IN ('نفسه', 'نفس', 'نفسها') AND v_last_product_name IS NOT NULL THEN
          v_product_name := v_last_product_name;
          v_is_continuation := true;
          CONTINUE;
        END IF;
        
        -- إضافة للاسم
        IF v_product_name != '' THEN
          v_product_name := v_product_name || ' ' || v_word;
        ELSE
          v_product_name := v_word;
        END IF;
      END LOOP;
      
      -- إذا لم يتم العثور على منتج، تجاهل السطر
      IF v_product_name = '' THEN
        CONTINUE;
      END IF;
      
      -- حفظ اسم المنتج للذاكرة
      v_last_product_name := v_product_name;
      
      -- البحث عن المنتج الأنسب
      v_max_score := 0;
      v_best_match := NULL;
      v_normalized_search := lower(trim(v_product_name));
      
      FOR v_found_product IN 
        SELECT 
          pv.id,
          pv.price,
          COALESCE(i.quantity - i.reserved_quantity, 0) as available_stock,
          p.name as product_name,
          COALESCE(c.name, 'افتراضي') as color_name,
          COALESCE(s.name, 'افتراضي') as size_name,
          p.id as product_id
        FROM product_variants pv
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        LEFT JOIN inventory i ON i.variant_id = pv.id
        WHERE LOWER(p.name) LIKE '%' || v_normalized_search || '%'
          OR v_normalized_search LIKE '%' || LOWER(p.name) || '%'
        ORDER BY p.name
      LOOP
        v_current_score := 0;
        
        -- نقاط التطابق الكامل
        IF LOWER(v_found_product.product_name) = v_normalized_search THEN
          v_current_score := v_current_score + 100;
        END IF;
        
        -- نقاط التطابق الجزئي
        IF POSITION(v_normalized_search IN LOWER(v_found_product.product_name)) > 0 THEN
          v_current_score := v_current_score + 50;
        END IF;
        
        -- نقاط اللون
        IF v_color_name != 'افتراضي' AND LOWER(v_found_product.color_name) = LOWER(v_color_name) THEN
          v_current_score := v_current_score + 30;
        ELSIF v_color_name = 'افتراضي' THEN
          v_current_score := v_current_score + 10;
        END IF;
        
        -- نقاط الحجم
        IF v_size_name != 'افتراضي' AND LOWER(v_found_product.size_name) = LOWER(v_size_name) THEN
          v_current_score := v_current_score + 20;
        ELSIF v_size_name = 'افتراضي' THEN
          v_current_score := v_current_score + 5;
        END IF;
        
        -- تفضيل المنتجات المتوفرة في المخزون
        IF v_found_product.available_stock > 0 THEN
          v_current_score := v_current_score + 15;
        END IF;
        
        -- حفظ الأفضل
        IF v_current_score > v_max_score THEN
          v_max_score := v_current_score;
          v_best_match := v_found_product;
        END IF;
      END LOOP;
      
      -- إذا لم يتم العثور على تطابق جيد، جرب تعميم القياس
      IF v_max_score < 50 AND v_size_name != 'افتراضي' THEN
        v_size_generalized := true;
        v_size_name := 'افتراضي';
        
        FOR v_found_product IN 
          SELECT 
            pv.id,
            pv.price,
            COALESCE(i.quantity - i.reserved_quantity, 0) as available_stock,
            p.name as product_name,
            COALESCE(c.name, 'افتراضي') as color_name,
            COALESCE(s.name, 'افتراضي') as size_name,
            p.id as product_id
          FROM product_variants pv
          JOIN products p ON pv.product_id = p.id
          LEFT JOIN colors c ON pv.color_id = c.id
          LEFT JOIN sizes s ON pv.size_id = s.id
          LEFT JOIN inventory i ON i.variant_id = pv.id
          WHERE LOWER(p.name) LIKE '%' || v_normalized_search || '%'
            OR v_normalized_search LIKE '%' || LOWER(p.name) || '%'
          ORDER BY p.name
        LOOP
          v_current_score := 0;
          
          IF LOWER(v_found_product.product_name) = v_normalized_search THEN
            v_current_score := v_current_score + 100;
          END IF;
          
          IF POSITION(v_normalized_search IN LOWER(v_found_product.product_name)) > 0 THEN
            v_current_score := v_current_score + 50;
          END IF;
          
          IF v_color_name != 'افتراضي' AND LOWER(v_found_product.color_name) = LOWER(v_color_name) THEN
            v_current_score := v_current_score + 30;
          ELSIF v_color_name = 'افتراضي' THEN
            v_current_score := v_current_score + 10;
          END IF;
          
          IF v_found_product.available_stock > 0 THEN
            v_current_score := v_current_score + 15;
          END IF;
          
          IF v_current_score > v_max_score THEN
            v_max_score := v_current_score;
            v_best_match := v_found_product;
          END IF;
        END LOOP;
      END IF;
      
      -- إضافة المنتج للقائمة
      IF v_best_match IS NOT NULL THEN
        v_product_items := v_product_items || jsonb_build_object(
          'variant_id', v_best_match.id,
          'product_id', v_best_match.product_id,
          'product_name', v_best_match.product_name,
          'color_name', v_best_match.color_name,
          'size_name', v_best_match.size_name,
          'quantity', v_quantity,
          'price', v_best_match.price,
          'available_stock', v_best_match.available_stock,
          'match_score', v_max_score,
          'size_generalized', v_size_generalized
        );
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN v_product_items;
END;
$function$;