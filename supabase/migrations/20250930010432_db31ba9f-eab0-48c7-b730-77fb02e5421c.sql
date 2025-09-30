-- حذف جميع دوال process_telegram_order المكررة والقديمة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, numeric, jsonb, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, numeric, jsonb, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, numeric, jsonb, bigint, text, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, numeric, jsonb, bigint, text, text, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, integer, integer, numeric, jsonb, bigint, text);

-- إنشاء دالة process_telegram_order الصحيحة والوحيدة
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_customer_id uuid;
  v_delivery_fee numeric := 5000; -- أجور التوصيل الافتراضية
  v_total_with_delivery numeric;
  v_items jsonb;
  v_item jsonb;
  v_customer_city text;
  v_customer_address text;
  v_region_name text := '';
  v_city_id integer;
  v_region_id integer;
  v_created_by uuid;
  v_customer_phone text;
  v_total_amount numeric;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام: %', p_order_data;
  
  -- استخراج البيانات من p_order_data
  v_items := COALESCE(p_order_data->>'items', '[]')::jsonb;
  v_customer_city := p_order_data->>'customer_city';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_phone := p_order_data->>'customer_phone';
  v_city_id := (p_order_data->>'city_id')::integer;
  v_region_id := (p_order_data->>'region_id')::integer;
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);
  
  -- تحديد المستخدم المنشئ (افتراضي: المدير)
  v_created_by := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  
  -- التحقق من الأخطاء في البيانات المستخرجة
  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب',
      'items', '[]'::jsonb,
      'delivery_fee', v_delivery_fee,
      'total_amount', 0,
      'customer_phone', v_customer_phone
    );
  END IF;
  
  -- التحقق من توفر العناصر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    IF NOT COALESCE((v_item->>'is_available')::boolean, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_item->>'alternatives_message', '❌ المنتج غير متوفر'),
        'items', v_items,
        'delivery_fee', v_delivery_fee,
        'total_amount', v_total_amount,
        'customer_phone', v_customer_phone
      );
    END IF;
  END LOOP;
  
  -- البحث عن المنطقة إذا كان city_id موجود
  IF v_city_id IS NOT NULL THEN
    -- البحث في النص عن المنطقة
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
  
  -- إنشاء الطلب في ai_orders (ليس orders)
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
    v_total_amount,
    p_employee_code,
    'telegram',
    p_chat_id,
    v_items,
    jsonb_build_object(
      'items', v_items,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'created_by', v_created_by,
      'total_amount', v_total_amount,
      'final_amount', v_total_with_delivery,
      'delivery_fee', v_delivery_fee,
      'customer_city', v_customer_city,
      'customer_name', COALESCE(p_order_data->>'customer_name', 'عميل تليغرام'),
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_province', COALESCE(p_order_data->>'customer_province', v_customer_city)
    ),
    p_order_data->>'original_text'
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✅ تم إنشاء الطلب في ai_orders بنجاح: %', v_order_id;
  
  -- إرجاع النتيجة الناجحة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'items', v_items,
    'delivery_fee', v_delivery_fee,
    'total_amount', v_total_amount,
    'final_amount', v_total_with_delivery,
    'customer_city', v_customer_city,
    'customer_region', v_region_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'order_data', jsonb_build_object(
      'items', v_items,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'created_by', v_created_by,
      'total_amount', v_total_amount,
      'final_amount', v_total_with_delivery,
      'delivery_fee', v_delivery_fee,
      'customer_city', v_customer_city,
      'customer_name', COALESCE(p_order_data->>'customer_name', 'عميل تليغرام'),
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'customer_province', COALESCE(p_order_data->>'customer_province', v_customer_city)
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', '❌ لم يتم إنشاء طلب!' || E'\n' || 'حدث خطأ في معالجة طلبك: ' || SQLERRM,
      'items', v_items,
      'delivery_fee', v_delivery_fee,
      'total_amount', 0,
      'customer_phone', v_customer_phone
    );
END;
$function$;