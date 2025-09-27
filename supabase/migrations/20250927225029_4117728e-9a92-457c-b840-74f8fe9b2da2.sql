-- إصلاح استدعاء smart_search_region في process_telegram_order
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
  v_customer_name text := NULL;
  v_temp_text text;
  v_temp_id uuid;
  v_color_match_result jsonb;
  v_size_match_result jsonb;
  v_final_result jsonb;
  v_city_search_result jsonb;
  v_region_search_result jsonb;
BEGIN
  -- تسجيل بداية المعالجة
  RAISE NOTICE '🔄 بدء معالجة الرسالة: %', p_message_text;
  
  -- تقسيم النص إلى كلمات
  v_words := string_to_array(lower(trim(p_message_text)), ' ');
  
  -- البحث عن رقم الهاتف
  v_temp_text := regexp_replace(p_message_text, '[^0-9+]', '', 'g');
  IF length(v_temp_text) >= 10 THEN
    v_phone := v_temp_text;
    RAISE NOTICE '📱 تم العثور على رقم الهاتف: %', v_phone;
  END IF;
  
  -- البحث عن المدينة والمنطقة
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث عن المدينة
    IF v_found_city_id IS NULL THEN
      SELECT result INTO v_city_search_result 
      FROM smart_search_city(v_word) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_city_search_result IS NOT NULL THEN
        v_found_city_id := (v_city_search_result->>'city_id')::integer;
        v_found_city_name := v_city_search_result->>'city_name';
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city_name, v_found_city_id;
      END IF;
    END IF;
    
    -- البحث عن المنطقة (الإصلاح هنا)
    IF v_found_region_id IS NULL THEN
      SELECT result INTO v_region_search_result 
      FROM smart_search_region(v_word, v_found_city_id) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_region_search_result IS NOT NULL THEN
        v_found_region_id := (v_region_search_result->>'region_id')::integer;
        v_found_region_name := v_region_search_result->>'region_name';
        RAISE NOTICE '📍 تم العثور على المنطقة: % (ID: %)', v_found_region_name, v_found_region_id;
      END IF;
    END IF;
  END LOOP;
  
  -- استخراج عناصر المنتجات
  SELECT extract_product_items_from_text(p_message_text) INTO v_product_items;
  RAISE NOTICE '🛍️ تم استخراج % عنصر من المنتجات', jsonb_array_length(v_product_items);
  
  -- حساب المبلغ الإجمالي
  FOR v_current_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_current_item->>'total_price')::numeric, 0);
  END LOOP;
  
  -- تحديد اسم العميل (أول كلمة غير رقمية وغير مدينة/منطقة)
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_customer_name IS NULL AND length(v_word) > 2 AND v_word !~ '[0-9]' 
       AND v_word != v_found_city_name AND v_word != v_found_region_name THEN
      v_customer_name := initcap(v_word);
      EXIT;
    END IF;
  END LOOP;
  
  -- بناء النتيجة النهائية
  v_final_result := jsonb_build_object(
    'success', true,
    'message', '✅ تم تحليل طلبك بنجاح! يرجى مراجعة التفاصيل والتأكيد.',
    'order_data', jsonb_build_object(
      'customer_name', COALESCE(v_customer_name, 'عميل'),
      'customer_phone', v_phone,
      'customer_city', v_found_city_name,
      'customer_region', v_found_region_name,
      'city_id', v_found_city_id,
      'region_id', v_found_region_id,
      'customer_address', p_message_text,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'source', 'telegram',
      'telegram_chat_id', p_chat_id,
      'original_text', p_message_text
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