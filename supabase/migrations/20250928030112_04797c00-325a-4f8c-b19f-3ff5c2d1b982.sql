-- إصلاح دالة process_telegram_order لتستخدم الدالة الأصلية الصحيحة
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_message_text text, p_chat_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order jsonb := '{}';
  v_words text[];
  v_word text;
  v_phone text := NULL;
  v_found_city_id integer := NULL;
  v_found_city_name text := NULL;
  v_found_region_id integer := NULL;
  v_found_region_name text := NULL;
  v_address_parts text[] := '{}';
  v_product_items jsonb := '[]';
  v_current_item jsonb;
  v_quantity integer := 1;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000; -- أجور التوصيل الثابتة
  v_customer_name text := NULL;
  v_temp_text text;
  v_temp_id uuid;
  v_final_result jsonb;
  v_normalized_text text;
  v_names_words text[] := '{}';
  v_product_colors text[] := '{}';
  v_product_sizes text[] := '{}';
  -- متغيرات منفصلة لنتائج البحث
  v_city_confidence numeric;
  v_region_confidence numeric;
  v_region_city_id integer;
  v_region_city_name text;
  v_region_match_type text;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء معالجة الرسالة: %', p_message_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(p_message_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- البحث عن رقم الهاتف
  v_temp_text := regexp_replace(p_message_text, '[^0-9+]', '', 'g');
  IF length(v_temp_text) >= 10 THEN
    v_phone := v_temp_text;
    RAISE NOTICE '📱 تم العثور على رقم الهاتف: %', v_phone;
  END IF;
  
  -- جمع الألوان والأحجام المتوفرة لتجنب اعتبارها أسماء
  SELECT array_agg(DISTINCT lower(c.name)) INTO v_product_colors 
  FROM colors c WHERE c.name IS NOT NULL;
  
  SELECT array_agg(DISTINCT lower(s.name)) INTO v_product_sizes 
  FROM sizes s WHERE s.name IS NOT NULL;
  
  -- البحث عن المدينة والمنطقة
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- تجاهل الكلمات القصيرة والأرقام
    IF length(v_word) < 3 OR v_word ~ '^[0-9]+$' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المدينة
    IF v_found_city_id IS NULL THEN
      SELECT city_id, city_name, confidence INTO v_found_city_id, v_found_city_name, v_city_confidence
      FROM smart_search_city(v_word) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_city_id IS NOT NULL THEN
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city_name, v_found_city_id;
      END IF;
    END IF;
    
    -- البحث عن المنطقة
    IF v_found_region_id IS NULL THEN
      SELECT region_id, region_name, city_id, city_name, match_type, confidence 
      INTO v_found_region_id, v_found_region_name, v_region_city_id, v_region_city_name, v_region_match_type, v_region_confidence
      FROM smart_search_region(v_word, v_found_city_id) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_region_id IS NOT NULL THEN
        RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region_name, v_found_region_id;
      END IF;
    END IF;
    
    -- جمع الكلمات المحتملة للأسماء (تجنب الألوان والأحجام والمدن)
    IF v_word NOT IN (
      SELECT unnest(v_product_colors) 
      UNION ALL 
      SELECT unnest(v_product_sizes)
      UNION ALL
      SELECT lower(v_found_city_name)
      UNION ALL
      SELECT lower(v_found_region_name)
    ) AND length(v_word) > 2 AND v_word !~ '[0-9]' THEN
      -- تحقق من أن الكلمة ليست منتجاً
      IF NOT EXISTS (SELECT 1 FROM products p WHERE lower(p.name) ILIKE '%' || v_word || '%') THEN
        v_names_words := v_names_words || v_word;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج عناصر المنتجات باستخدام الدالة الأصلية الصحيحة
  v_product_items := extract_product_items_from_text(p_message_text);
  
  RAISE NOTICE '🛍️ تم استخراج % عنصر من المنتجات', jsonb_array_length(v_product_items);
  
  -- حساب المبلغ الإجمالي (سعر المنتجات فقط)
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_current_item->>'total_price')::numeric, 0);
  END LOOP;
  
  -- تحديد اسم العميل من الكلمات المحتملة
  IF array_length(v_names_words, 1) > 0 THEN
    v_customer_name := initcap(v_names_words[1]);
  ELSE
    v_customer_name := 'عميل';
  END IF;
  
  -- العثور على المستخدم المسؤول عن هذا الطلب بناءً على chat_id
  SELECT user_id INTO v_temp_id 
  FROM employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id 
    AND is_active = true 
  LIMIT 1;
  
  -- إذا لم يوجد مستخدم مرتبط، استخدم المدير الافتراضي
  IF v_temp_id IS NULL THEN
    v_temp_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  END IF;
  
  -- بناء النتيجة النهائية مع المبلغ الإجمالي (منتجات + توصيل)
  v_final_result := jsonb_build_object(
    'success', true,
    'message', '✅ تم تحليل طلبك بنجاح! يرجى مراجعة التفاصيل والتأكيد.',
    'order_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_phone,
      'customer_city', v_found_city_name,
      'customer_province', v_found_region_name,
      'city_id', v_found_city_id,
      'region_id', v_found_region_id,
      'customer_address', p_message_text,
      'items', v_product_items,
      'total_amount', v_total_amount + v_delivery_fee, -- المبلغ الإجمالي شامل التوصيل
      'products_amount', v_total_amount, -- مبلغ المنتجات منفصل
      'delivery_fee', v_delivery_fee, -- أجور التوصيل منفصلة
      'source', 'telegram',
      'telegram_chat_id', p_chat_id,
      'original_text', p_message_text,
      'created_by', v_temp_id
    )
  );
  
  -- إضافة خيارات إضافية إذا لم يتم العثور على مدينة أو منطقة
  IF v_found_city_id IS NULL THEN
    v_final_result := jsonb_set(v_final_result, '{needs_city_selection}', 'true');
    v_final_result := jsonb_set(v_final_result, '{message}', '"⚠️ لم يتم التعرف على المدينة. يرجى تحديد المدينة:"');
  END IF;
  
  IF v_found_region_id IS NULL AND v_found_city_id IS NOT NULL THEN
    v_final_result := jsonb_set(v_final_result, '{needs_region_selection}', 'true');
    v_final_result := jsonb_set(v_final_result, '{message}', '"⚠️ لم يتم التعرف على المنطقة. يرجى تحديد المنطقة:"');
  END IF;
  
  RAISE NOTICE '✅ انتهاء المعالجة بنجاح: %', v_final_result;
  RETURN v_final_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'details', SQLERRM,
      'message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة أو التواصل مع الدعم.'
    );
END;
$function$;