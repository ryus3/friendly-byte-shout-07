-- تحسين استخراج landmark في process_telegram_order
-- الهدف: تحسين شرط إزالة المنطقة والحفاظ على landmarks مثل "شارع السعدون"

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_text text,
  p_telegram_chat_id bigint DEFAULT NULL,
  p_created_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_name text := 'زبون تليغرام';
  v_customer_phone text := 'غير محدد';
  v_city_name text := 'غير محدد';
  v_city_id integer := NULL;
  v_region_name text := 'غير محدد';
  v_region_id integer := NULL;
  v_full_address text := '';
  v_landmark text := 'غير محدد';
  v_items jsonb := '[]'::jsonb;
  v_total_amount numeric := 0;
  v_address_lines text[];
  v_line text;
  v_temp_landmark text;
  v_words text[];
  v_word_count integer;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام: %', p_text;
  
  -- تقسيم النص إلى أسطر
  v_address_lines := string_to_array(p_text, E'\n');
  
  -- معالجة السطر الأول (قد يكون اسم أو عنوان)
  IF array_length(v_address_lines, 1) >= 1 THEN
    v_line := trim(v_address_lines[1]);
    RAISE NOTICE '📝 السطر الأول: %', v_line;
    
    -- عد الكلمات في السطر الأول
    v_words := regexp_split_to_array(v_line, E'\\s+');
    v_word_count := array_length(v_words, 1);
    
    -- إذا كان السطر الأول يحتوي على 1-3 كلمات فقط، نعتبره اسماً
    IF v_word_count > 0 AND v_word_count <= 3 AND v_line !~ '(محافظة|مدينة|قضاء|ناحية|حي|منطقة|شارع|زقاق)' THEN
      v_customer_name := v_line;
      RAISE NOTICE '👤 تم استخراج اسم الزبون: %', v_customer_name;
    ELSE
      -- السطر الأول جزء من العنوان
      v_customer_name := 'زبون تليغرام';
      RAISE NOTICE '⚠️ السطر الأول يبدو أنه عنوان، استخدام الاسم الافتراضي';
    END IF;
  END IF;
  
  -- معالجة السطر الثاني (المدينة والمنطقة)
  IF array_length(v_address_lines, 1) >= 2 THEN
    v_line := trim(v_address_lines[2]);
    RAISE NOTICE '🏙️ السطر الثاني (المدينة والمنطقة): %', v_line;
    
    -- البحث الذكي عن المدينة
    SELECT city_id, city_name INTO v_city_id, v_city_name
    FROM smart_search_city(v_line)
    ORDER BY confidence DESC
    LIMIT 1;
    
    IF v_city_id IS NOT NULL THEN
      RAISE NOTICE '✅ تم العثور على المدينة: % (ID: %)', v_city_name, v_city_id;
      
      -- محاولة استخراج المنطقة من نفس السطر
      DECLARE
        v_normalized_city text := lower(trim(v_city_name));
        v_temp_line text := lower(trim(v_line));
        v_region_candidates text[];
        v_candidate text;
      BEGIN
        -- إزالة اسم المدينة من السطر
        v_temp_line := trim(regexp_replace(v_temp_line, v_normalized_city, '', 'gi'));
        v_temp_line := trim(regexp_replace(v_temp_line, E'\\s+', ' ', 'g'));
        
        -- إزالة كلمات التوقف
        v_temp_line := regexp_replace(v_temp_line, '(محافظة|مدينة|قضاء|ناحية|حي|منطقة)', '', 'gi');
        v_temp_line := trim(v_temp_line);
        
        RAISE NOTICE '🔍 البحث عن منطقة في: "%"', v_temp_line;
        
        -- توليد مرشحات محتملة للمنطقة (2-4 كلمات)
        v_region_candidates := ARRAY[]::text[];
        v_words := regexp_split_to_array(v_temp_line, E'\\s+');
        
        FOR i IN 1..LEAST(4, array_length(v_words, 1)) LOOP
          FOR j IN 1..(array_length(v_words, 1) - i + 1) LOOP
            v_candidate := trim(array_to_string(v_words[j:j+i-1], ' '));
            IF length(v_candidate) >= 2 THEN
              v_region_candidates := array_append(v_region_candidates, v_candidate);
            END IF;
          END LOOP;
        END LOOP;
        
        -- البحث عن أفضل مطابقة للمنطقة
        SELECT rc.id, rc.name INTO v_region_id, v_region_name
        FROM regions_cache rc
        WHERE rc.city_id = v_city_id
          AND rc.is_active = true
          AND EXISTS (
            SELECT 1 FROM unnest(v_region_candidates) AS candidate
            WHERE lower(rc.name) = lower(candidate)
               OR lower(rc.name) LIKE '%' || lower(candidate) || '%'
               OR lower(candidate) LIKE '%' || lower(rc.name) || '%'
          )
        ORDER BY 
          CASE 
            WHEN EXISTS (SELECT 1 FROM unnest(v_region_candidates) AS c WHERE lower(rc.name) = lower(c)) THEN 1
            WHEN EXISTS (SELECT 1 FROM unnest(v_region_candidates) AS c WHERE lower(rc.name) LIKE lower(c) || '%') THEN 2
            ELSE 3
          END,
          length(rc.name) DESC
        LIMIT 1;
        
        IF v_region_id IS NOT NULL THEN
          RAISE NOTICE '✅ تم العثور على المنطقة: % (ID: %)', v_region_name, v_region_id;
        ELSE
          RAISE NOTICE '⚠️ لم يتم العثور على منطقة مطابقة في: "%"', v_temp_line;
        END IF;
      END;
    ELSE
      RAISE NOTICE '⚠️ لم يتم العثور على مدينة مطابقة';
    END IF;
  END IF;
  
  -- معالجة السطر الثالث (landmark - نقطة مرجعية)
  IF array_length(v_address_lines, 1) >= 3 THEN
    v_line := trim(v_address_lines[3]);
    RAISE NOTICE '📍 السطر الثالث (landmark): %', v_line;
    
    v_temp_landmark := lower(trim(v_line));
    
    -- إزالة اسم المدينة
    IF v_city_name != 'غير محدد' THEN
      v_temp_landmark := trim(regexp_replace(v_temp_landmark, lower(v_city_name), '', 'gi'));
    END IF;
    
    -- 🔧 تحسين شرط إزالة المنطقة - إزالة المنطقة إذا لم تكن "غير محدد"
    IF v_region_name IS NOT NULL AND v_region_name != 'غير محدد' THEN
      v_temp_landmark := trim(regexp_replace(v_temp_landmark, lower(v_region_name), '', 'gi'));
      RAISE NOTICE '🔧 إزالة المنطقة "%" من landmark', v_region_name;
    END IF;
    
    -- تنظيف المسافات المتعددة
    v_temp_landmark := trim(regexp_replace(v_temp_landmark, E'\\s+', ' ', 'g'));
    
    -- إزالة كلمات التوقف الشائعة فقط
    v_temp_landmark := regexp_replace(v_temp_landmark, '^(محافظة|مدينة|قضاء|ناحية)\\s+', '', 'gi');
    v_temp_landmark := trim(v_temp_landmark);
    
    -- إذا كان الناتج غير فارغ وطويل بما فيه الكفاية، استخدمه
    IF length(v_temp_landmark) >= 3 THEN
      v_landmark := v_temp_landmark;
      RAISE NOTICE '✅ تم استخراج landmark: "%"', v_landmark;
    ELSE
      v_landmark := 'غير محدد';
      RAISE NOTICE '⚠️ landmark فارغ أو قصير جداً، استخدام الافتراضي';
    END IF;
  END IF;
  
  -- بناء العنوان الكامل
  v_full_address := v_city_name;
  IF v_region_name != 'غير محدد' THEN
    v_full_address := v_full_address || ' - ' || v_region_name;
  END IF;
  IF v_landmark != 'غير محدد' THEN
    v_full_address := v_full_address || ' - ' || v_landmark;
  END IF;
  
  RAISE NOTICE '📋 العنوان الكامل المُنشأ: %', v_full_address;
  
  -- معالجة السطر الرابع (رقم الهاتف)
  IF array_length(v_address_lines, 1) >= 4 THEN
    v_line := trim(v_address_lines[4]);
    RAISE NOTICE '📞 السطر الرابع (رقم الهاتف): %', v_line;
    v_customer_phone := extractphonefromtext(v_line);
    RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_customer_phone;
  END IF;
  
  -- استخراج المنتجات من السطور المتبقية
  FOR i IN 5..COALESCE(array_length(v_address_lines, 1), 0) LOOP
    v_line := trim(v_address_lines[i]);
    IF length(v_line) > 0 THEN
      RAISE NOTICE '📦 معالجة سطر المنتج: %', v_line;
      DECLARE
        v_product_items jsonb;
      BEGIN
        v_product_items := extract_product_items_from_text(v_line);
        IF jsonb_array_length(v_product_items) > 0 THEN
          v_items := v_items || v_product_items;
          -- حساب المبلغ الإجمالي من المنتجات
          v_total_amount := v_total_amount + (
            SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
            FROM jsonb_array_elements(v_product_items) AS item
          );
        END IF;
      END;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ اكتمل استخراج الطلب - العناصر: %, المبلغ: %', jsonb_array_length(v_items), v_total_amount;
  
  -- إرجاع البيانات المستخرجة
  RETURN jsonb_build_object(
    'success', true,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'city', v_city_name,
    'city_id', v_city_id,
    'region', v_region_name,
    'region_id', v_region_id,
    'landmark', v_landmark,
    'full_address', v_full_address,
    'items', v_items,
    'total_amount', v_total_amount,
    'original_text', p_text
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'customer_name', 'زبون تليغرام',
      'customer_phone', 'غير محدد',
      'city', 'غير محدد',
      'region', 'غير محدد',
      'landmark', 'غير محدد',
      'full_address', 'غير محدد',
      'items', '[]'::jsonb,
      'total_amount', 0
    );
END;
$function$;