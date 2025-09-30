-- Remove all existing process_telegram_order functions
DROP FUNCTION IF EXISTS public.process_telegram_order(input_text text, employee_id uuid);
DROP FUNCTION IF EXISTS public.process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_code text);
DROP FUNCTION IF EXISTS public.process_telegram_order(p_order_data jsonb, p_employee_code text, p_chat_id bigint);

-- Create the corrected function with proper amount calculation
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_employee_code text DEFAULT NULL::text, p_chat_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_total_with_delivery numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_city_id integer;
  v_region_id integer;
  v_region_name text;
  v_order_id uuid;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة الطلب: %', p_order_data;
  
  -- استخراج البيانات الأساسية
  v_customer_phone := COALESCE(p_order_data->>'customer_phone', '');
  v_customer_address := COALESCE(p_order_data->>'customer_address', '');
  v_customer_city := COALESCE(p_order_data->>'customer_city', '');
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);
  
  -- البحث عن المدينة
  IF v_customer_city IS NOT NULL AND v_customer_city != '' THEN
    SELECT id INTO v_city_id
    FROM cities_cache
    WHERE is_active = true
      AND (
        lower(name) = lower(v_customer_city)
        OR lower(name) LIKE '%' || lower(v_customer_city) || '%'
        OR lower(v_customer_city) LIKE '%' || lower(name) || '%'
      )
    ORDER BY 
      CASE WHEN lower(name) = lower(v_customer_city) THEN 1
           WHEN lower(name) LIKE lower(v_customer_city) || '%' THEN 2
           ELSE 3 END
    LIMIT 1;
    
    IF v_city_id IS NOT NULL THEN
      RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_customer_city, v_city_id;
    ELSE
      RAISE NOTICE '⚠️ لم يتم العثور على المدينة: %', v_customer_city;
    END IF;
  END IF;
  
  -- البحث عن المنطقة إذا وُجدت المدينة
  IF v_city_id IS NOT NULL AND v_customer_address IS NOT NULL AND v_customer_address != '' THEN
    DECLARE
      search_words text[];
      word text;
      region_result record;
    BEGIN
      search_words := string_to_array(lower(v_customer_address), ' ');
      
      FOREACH word IN ARRAY search_words
      LOOP
        IF length(word) > 2 THEN
          SELECT rc.id, rc.name INTO region_result
          FROM regions_cache rc
          WHERE rc.city_id = v_city_id
            AND rc.is_active = true
            AND (
              lower(rc.name) LIKE '%' || word || '%'
              OR word LIKE '%' || lower(rc.name) || '%'
            )
          ORDER BY 
            CASE WHEN lower(rc.name) = word THEN 1
                 WHEN lower(rc.name) LIKE word || '%' THEN 2
                 ELSE 3 END
          LIMIT 1;
          
          IF region_result.id IS NOT NULL THEN
            v_region_id := region_result.id;
            v_region_name := region_result.name;
            RAISE NOTICE '🗺️ تم العثور على المنطقة: % (ID: %)', v_region_name, v_region_id;
            EXIT;
          END IF;
        END IF;
      END LOOP;
    END;
  END IF;
  
  -- حساب المبلغ الإجمالي مع أجور التوصيل
  v_total_with_delivery := v_total_amount + v_delivery_fee;
  
  -- إنشاء الطلب في ai_orders مع المبلغ الإجمالي الصحيح (v_total_with_delivery)
  INSERT INTO ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    city_id,
    region_id,
    status,
    total_amount,
    created_by,
    source,
    telegram_chat_id,
    items,
    order_data,
    original_text
  ) VALUES (
    COALESCE(p_order_data->>'customer_name', 'عميل تليغرام'),
    v_customer_phone,
    v_customer_city,
    COALESCE(p_order_data->>'customer_province', v_customer_city),
    v_customer_address,
    v_city_id,
    v_region_id,
    'pending',
    v_total_with_delivery, -- المبلغ الإجمالي مع التوصيل بدلاً من v_total_amount
    p_employee_code,
    'telegram',
    p_chat_id,
    v_items,
    jsonb_build_object(
      'items', v_items,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'delivery_fee', v_delivery_fee,
      'product_total', v_total_amount,
      'final_total', v_total_with_delivery
    ),
    COALESCE(p_order_data->>'original_text', '')
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح - ID: %، المبلغ الإجمالي: %', v_order_id, v_total_with_delivery;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', COALESCE(p_order_data->>'customer_name', 'عميل تليغرام'),
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'items', v_items,
    'product_total', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'final_amount', v_total_with_delivery,
    'total_amount', v_total_with_delivery -- للتوافق مع الكود الحالي
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'product_total', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_with_delivery
    );
END;
$function$;