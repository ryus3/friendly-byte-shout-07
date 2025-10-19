-- استعادة النسخة الناجحة من 8 أكتوبر
-- حذف النسخة الحالية
DROP FUNCTION IF EXISTS public.extract_product_items_from_text(text);

-- إعادة إنشاء الدالة الناجحة
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_parts text[];
  v_part text;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  
  -- متغيرات الذاكرة
  v_last_product_id uuid;
  v_last_product_name text;
  v_last_color_id uuid;
  v_last_color_name text;
  
  -- متغيرات استخراج البيانات
  v_quantity integer;
  v_product_id uuid;
  v_product_name text;
  v_color_id uuid;
  v_color_name text;
  v_size_id uuid;
  v_size_name text;
  
  -- متغيرات البحث
  v_search_text text;
  v_normalized_text text;
  v_color_found boolean;
  v_size_found boolean;
  
  -- رسالة الخطأ
  v_error_msg text;
  v_alternatives text;
BEGIN
  -- تنظيف النص وتقسيمه على +
  v_parts := string_to_array(
    regexp_replace(trim(p_text), '\s+', ' ', 'g'),
    '+'
  );
  
  -- معالجة كل جزء
  FOR i IN 1..array_length(v_parts, 1) LOOP
    BEGIN
      v_part := trim(v_parts[i]);
      v_normalized_text := lower(v_part);
      
      -- استخراج الكمية (1-100)
      v_quantity := 1;
      IF v_normalized_text ~ '^\d+\s+' THEN
        v_quantity := substring(v_normalized_text from '^\d+')::integer;
        IF v_quantity < 1 OR v_quantity > 100 THEN
          v_quantity := 1;
        END IF;
        v_normalized_text := trim(regexp_replace(v_normalized_text, '^\d+\s*', ''));
      END IF;
      
      -- البحث عن المنتج
      v_product_id := NULL;
      v_product_name := NULL;
      
      SELECT id, name INTO v_product_id, v_product_name
      FROM products
      WHERE lower(name) = ANY(string_to_array(v_normalized_text, ' '))
         OR v_normalized_text LIKE '%' || lower(name) || '%'
      ORDER BY 
        CASE 
          WHEN lower(name) = split_part(v_normalized_text, ' ', 1) THEN 1
          WHEN v_normalized_text LIKE lower(name) || '%' THEN 2
          ELSE 3
        END
      LIMIT 1;
      
      -- إذا لم يتم العثور على منتج، استخدم الذاكرة
      IF v_product_id IS NULL THEN
        v_product_id := v_last_product_id;
        v_product_name := v_last_product_name;
      ELSE
        v_last_product_id := v_product_id;
        v_last_product_name := v_product_name;
      END IF;
      
      -- إذا لم يتم العثور على منتج نهائياً
      IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على أي منتج في النص';
      END IF;
      
      -- البحث عن اللون
      v_color_id := NULL;
      v_color_name := NULL;
      v_color_found := false;
      
      FOR v_search_text IN
        SELECT unnest(string_to_array(v_normalized_text, ' '))
      LOOP
        SELECT id, name INTO v_color_id, v_color_name
        FROM colors
        WHERE lower(name) = v_search_text
        LIMIT 1;
        
        IF v_color_id IS NOT NULL THEN
          v_color_found := true;
          EXIT;
        END IF;
      END LOOP;
      
      -- إذا لم يتم العثور على لون، استخدم الذاكرة
      IF NOT v_color_found THEN
        v_color_id := v_last_color_id;
        v_color_name := v_last_color_name;
      ELSE
        v_last_color_id := v_color_id;
        v_last_color_name := v_color_name;
      END IF;
      
      -- البحث عن الحجم
      v_size_id := NULL;
      v_size_name := NULL;
      v_size_found := false;
      
      FOR v_search_text IN
        SELECT unnest(string_to_array(v_normalized_text, ' '))
      LOOP
        SELECT id, name INTO v_size_id, v_size_name
        FROM sizes
        WHERE lower(name) = v_search_text
           OR lower(name) = 
              CASE v_search_text
                WHEN 'سمول' THEN 's'
                WHEN 'ميديم' THEN 'm'
                WHEN 'لارج' THEN 'l'
                WHEN 'اكس' THEN 'xl'
                WHEN 'اكسل' THEN 'xl'
                ELSE v_search_text
              END
        LIMIT 1;
        
        IF v_size_id IS NOT NULL THEN
          v_size_found := true;
          EXIT;
        END IF;
      END LOOP;
      
      -- التحقق من توفر المنتج
      IF NOT EXISTS (
        SELECT 1 FROM inventory i
        JOIN product_variants pv ON i.variant_id = pv.id
        WHERE pv.product_id = v_product_id
          AND (v_color_id IS NULL OR pv.color_id = v_color_id)
          AND (v_size_id IS NULL OR pv.size_id = v_size_id)
          AND i.available_quantity >= v_quantity
      ) THEN
        -- بناء رسالة خطأ ذكية مع البدائل
        v_error_msg := '❌ لم يتم إنشاء طلب!' || E'\n';
        v_error_msg := v_error_msg || 'المنتج "' || v_product_name || '"';
        
        IF v_color_name IS NOT NULL THEN
          v_error_msg := v_error_msg || ' اللون "' || v_color_name || '"';
        END IF;
        
        IF v_size_name IS NOT NULL THEN
          v_error_msg := v_error_msg || ' المقاس "' || v_size_name || '"';
        END IF;
        
        v_error_msg := v_error_msg || ' غير متوفر' || E'\n\n';
        
        -- جلب البدائل المتوفرة
        SELECT string_agg(
          '• ' || COALESCE(c.name, 'افتراضي') || ' : ' || 
          string_agg(DISTINCT s.name, ', ' ORDER BY s.name),
          E'\n'
          ORDER BY c.name
        ) INTO v_alternatives
        FROM inventory i
        JOIN product_variants pv ON i.variant_id = pv.id
        LEFT JOIN colors c ON pv.color_id = c.id
        LEFT JOIN sizes s ON pv.size_id = s.id
        WHERE pv.product_id = v_product_id
          AND i.available_quantity > 0
        GROUP BY c.id, c.name;
        
        IF v_alternatives IS NOT NULL THEN
          v_error_msg := v_error_msg || '✅ الألوان والأحجام المتوفرة:' || E'\n' || v_alternatives;
        ELSE
          v_error_msg := v_error_msg || '⚠️ هذا المنتج غير متوفر بالكامل حالياً';
        END IF;
        
        RAISE EXCEPTION '%', v_error_msg;
      END IF;
      
      -- إضافة العنصر
      v_item := jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product_name,
        'color_id', v_color_id,
        'color_name', v_color_name,
        'size_id', v_size_id,
        'size_name', v_size_name,
        'quantity', v_quantity
      );
      
      v_items := v_items || v_item;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE;
    END;
  END LOOP;
  
  RETURN v_items;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', true,
    'message', SQLERRM
  );
END;
$function$;