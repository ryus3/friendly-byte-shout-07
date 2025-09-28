-- إزالة الدالة المعطلة واستبدالها بدالة محسنة تعمل مع جدول ai_orders
DROP FUNCTION IF EXISTS public.process_telegram_order_detailed(text, bigint, bigint, text);

CREATE OR REPLACE FUNCTION public.process_telegram_order_detailed(
  p_message_text text, 
  p_chat_id bigint,
  p_telegram_user_id bigint DEFAULT NULL,
  p_telegram_username text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_result jsonb;
  v_order_data jsonb;
  v_phone text := NULL;
  v_found_city_id integer := NULL;
  v_found_city_name text := NULL;
  v_found_region_id integer := NULL;
  v_found_region_name text := NULL;
  v_product_items jsonb := '[]';
  v_total_amount numeric := 0;
  v_customer_name text := NULL;
  v_words text[];
  v_word text;
  v_normalized_word text;
  v_product record;
  v_color record;
  v_size record;
  v_temp_text text;
  v_city_confidence numeric;
  v_region_confidence numeric;
  v_current_item jsonb;
  v_ai_order_id uuid;
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
  
  -- البحث عن المدينة
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    IF v_found_city_id IS NULL AND length(v_normalized_word) > 2 THEN
      SELECT city_id, city_name, confidence INTO v_found_city_id, v_found_city_name, v_city_confidence
      FROM smart_search_city(v_normalized_word) 
      ORDER BY confidence DESC 
      LIMIT 1;
      
      IF v_found_city_id IS NOT NULL THEN
        RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_found_city_name, v_found_city_id;
      END IF;
    END IF;
  END LOOP;
  
  -- البحث عن المنتجات
  FOREACH v_word IN ARRAY v_words
  LOOP
    v_normalized_word := trim(lower(v_word));
    
    IF length(v_normalized_word) > 2 THEN
      FOR v_product IN 
        SELECT id, name, base_price 
        FROM products 
        WHERE lower(name) ILIKE '%' || v_normalized_word || '%'
          AND is_active = true
        ORDER BY 
          CASE 
            WHEN lower(name) = v_normalized_word THEN 1
            WHEN lower(name) ILIKE v_normalized_word || '%' THEN 2
            ELSE 3
          END
        LIMIT 1
      LOOP
        -- البحث عن الألوان والأحجام في النص
        FOR v_color IN 
          SELECT id, name FROM colors 
          WHERE lower(p_message_text) ILIKE '%' || lower(name) || '%'
          LIMIT 1
        LOOP
          FOR v_size IN 
            SELECT id, name FROM sizes 
            WHERE lower(p_message_text) ILIKE '%' || lower(name) || '%'
            LIMIT 1
          LOOP
            -- إنشاء عنصر المنتج
            v_current_item := jsonb_build_object(
              'product_id', v_product.id,
              'product_name', v_product.name,
              'color_id', v_color.id,
              'color', v_color.name,
              'size_id', v_size.id,
              'size', v_size.name,
              'quantity', 1,
              'price', COALESCE(v_product.base_price, 0),
              'total_price', COALESCE(v_product.base_price, 0)
            );
            
            v_product_items := v_product_items || jsonb_build_array(v_current_item);
            v_total_amount := v_total_amount + COALESCE(v_product.base_price, 0);
            
            RAISE NOTICE '🛍️ تم إضافة منتج: % - % - %', v_product.name, v_color.name, v_size.name;
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
  
  -- تحديد اسم العميل
  FOREACH v_word IN ARRAY v_words
  LOOP
    IF v_customer_name IS NULL AND length(v_word) > 2 AND v_word !~ '[0-9]' THEN
      v_customer_name := initcap(v_word);
      EXIT;
    END IF;
  END LOOP;
  
  -- بناء بيانات الطلب
  v_order_data := jsonb_build_object(
    'customer_name', COALESCE(v_customer_name, 'عميل'),
    'customer_phone', v_phone,
    'customer_city', v_found_city_name,
    'customer_region', null, -- سيتم تحديده لاحقاً
    'city_id', v_found_city_id,
    'region_id', v_found_region_id,
    'customer_address', p_message_text,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'source', 'telegram',
    'telegram_chat_id', p_chat_id,
    'telegram_user_id', p_telegram_user_id,
    'telegram_username', p_telegram_username,
    'original_text', p_message_text
  );
  
  -- إدراج الطلب في جدول ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    region_id,
    telegram_chat_id,
    original_text,
    items,
    total_amount,
    order_data,
    source,
    status
  ) VALUES (
    COALESCE(v_customer_name, 'عميل'),
    v_phone,
    v_found_city_name,
    p_message_text,
    v_found_city_id,
    v_found_region_id,
    p_chat_id,
    p_message_text,
    v_product_items,
    v_total_amount,
    v_order_data,
    'telegram',
    'pending'
  ) RETURNING id INTO v_ai_order_id;
  
  -- بناء النتيجة النهائية
  IF jsonb_array_length(v_product_items) > 0 AND v_phone IS NOT NULL THEN
    v_order_result := jsonb_build_object(
      'success', true,
      'message', '✅ تم استلام الطلب بنجاح!',
      'order_id', v_ai_order_id,
      'customer_phone', v_phone,
      'customer_city', v_found_city_name,
      'customer_region', v_found_region_name,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'formatted_amount', CASE 
        WHEN v_total_amount > 0 THEN format('%s د.ع', to_char(v_total_amount, 'FM999,999,999'))
        ELSE 'غير محدد'
      END
    );
  ELSE
    -- تحديد نوع المشكلة
    IF v_phone IS NULL THEN
      v_order_result := jsonb_build_object(
        'success', false,
        'message', '⚠️ يرجى إدخال رقم الهاتف مع الطلب'
      );
    ELSIF jsonb_array_length(v_product_items) = 0 THEN
      v_order_result := jsonb_build_object(
        'success', false,
        'message', '⚠️ لم يتم التعرف على أي منتج في النص. يرجى كتابة اسم المنتج واللون والحجم بوضوح'
      );
    ELSIF v_found_city_id IS NULL THEN
      v_order_result := jsonb_build_object(
        'success', false,
        'message', '⚠️ لم يتم التعرف على المدينة. يرجى كتابة المدينة بوضوح'
      );
    ELSE
      v_order_result := jsonb_build_object(
        'success', false,
        'message', '⚠️ لم أتمكن من فهم الطلب بشكل كامل. يرجى التأكد من كتابة: اسم المنتج، اللون، الحجم، المدينة، ورقم الهاتف'
      );
    END IF;
  END IF;
  
  RAISE NOTICE '✅ انتهاء المعالجة: %', v_order_result;
  RETURN v_order_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'details', SQLERRM,
      'error_type', 'system_error',
      'response_message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى إعادة المحاولة أو التواصل مع الدعم.'
    );
END;
$function$;