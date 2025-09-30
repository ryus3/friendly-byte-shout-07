-- تحديث دالة process_telegram_order لاستخدام البحث الذكي للمناطق واستخراج أقرب نقطة دالة
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, uuid);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id bigint,
  p_message_text text,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_items jsonb;
  v_phone text;
  v_city_result record;
  v_region_result record;
  v_address text;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_city_name text := 'غير محدد';
  v_region_name text := 'غير محدد';
  v_landmark text := 'غير محدد';
  v_first_line text;
  v_clean_landmark text;
BEGIN
  RAISE NOTICE '🔄 معالجة طلب تليغرام - Chat ID: %, النص: %', p_chat_id, p_message_text;

  -- استخراج المنتجات باستخدام الدالة المخصصة
  v_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items;

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_phone;

  -- البحث الذكي عن المدينة
  SELECT city_name, confidence INTO v_city_result
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_result.city_name IS NOT NULL THEN
    v_city_name := v_city_result.city_name;
    RAISE NOTICE '🏙️ المدينة المستخرجة: % (ثقة: %)', v_city_name, v_city_result.confidence;
  END IF;

  -- البحث الذكي عن المنطقة
  SELECT region_name, confidence INTO v_region_result
  FROM smart_search_region(p_message_text, v_city_name)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_region_result.region_name IS NOT NULL THEN
    v_region_name := v_region_result.region_name;
    RAISE NOTICE '📍 المنطقة المستخرجة: % (ثقة: %)', v_region_name, v_region_result.confidence;
  END IF;

  -- استخراج أقرب نقطة دالة من السطر الأول
  v_first_line := SPLIT_PART(p_message_text, E'\n', 1);
  RAISE NOTICE '📄 السطر الأول: %', v_first_line;

  -- تنظيف السطر الأول من المدينة والمنطقة ورقم الهاتف وأسماء المنتجات
  v_clean_landmark := v_first_line;
  
  -- حذف اسم المدينة
  v_clean_landmark := regexp_replace(v_clean_landmark, v_city_name, '', 'gi');
  
  -- حذف اسم المنطقة
  v_clean_landmark := regexp_replace(v_clean_landmark, v_region_name, '', 'gi');
  
  -- حذف رقم الهاتف
  v_clean_landmark := regexp_replace(v_clean_landmark, v_phone, '', 'g');
  
  -- حذف أسماء المنتجات من v_items
  FOR i IN 0..jsonb_array_length(v_items)-1 LOOP
    v_clean_landmark := regexp_replace(
      v_clean_landmark, 
      (v_items->i->>'product_name'), 
      '', 
      'gi'
    );
  END LOOP;
  
  -- تنظيف المسافات الزائدة
  v_clean_landmark := TRIM(regexp_replace(v_clean_landmark, '\s+', ' ', 'g'));
  
  -- إذا كان الناتج فارغاً أو قصير جداً، استخدم القيمة الافتراضية
  IF v_clean_landmark IS NULL OR LENGTH(v_clean_landmark) < 3 THEN
    v_landmark := 'غير محدد';
  ELSE
    v_landmark := v_clean_landmark;
  END IF;
  
  RAISE NOTICE '🏠 أقرب نقطة دالة المستخرجة: %', v_landmark;

  -- بناء العنوان النهائي
  v_address := v_city_name || ' - ' || v_region_name || 
    CASE WHEN v_landmark != 'غير محدد' THEN ' - ' || v_landmark ELSE '' END;
  RAISE NOTICE '🏠 العنوان النهائي: %', v_address;

  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item;

  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;

  -- التحقق من توفر المنتجات
  IF EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(v_items) AS item
    WHERE (item->>'is_available')::boolean = false
  ) THEN
    DECLARE
      v_unavailable_item jsonb;
      v_alternatives_msg text;
    BEGIN
      SELECT item INTO v_unavailable_item
      FROM jsonb_array_elements(v_items) AS item
      WHERE (item->>'is_available')::boolean = false
      LIMIT 1;
      
      v_alternatives_msg := v_unavailable_item->>'alternatives_message';
      
      RAISE NOTICE '❌ منتج غير متوفر - الرسالة: %', v_alternatives_msg;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', v_alternatives_msg,
        'extracted_data', jsonb_build_object(
          'phone', v_phone,
          'city', v_city_name,
          'region', v_region_name,
          'landmark', v_landmark,
          'address', v_address,
          'items', v_items,
          'total_amount', v_total_amount,
          'delivery_fee', v_delivery_fee,
          'final_amount', v_total_amount + v_delivery_fee
        )
      );
    END;
  END IF;

  -- إنشاء سجل ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_phone,
    customer_city,
    customer_address,
    items,
    total_amount,
    order_data,
    status,
    source,
    created_by
  ) VALUES (
    p_chat_id,
    p_message_text,
    v_phone,
    v_city_name,
    v_address,
    v_items,
    v_total_amount + v_delivery_fee,
    jsonb_build_object(
      'city', v_city_name,
      'region', v_region_name,
      'landmark', v_landmark,
      'phone', v_phone,
      'items', v_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'confidence', COALESCE(v_city_result.confidence, 0)
    ),
    'pending',
    'telegram',
    COALESCE(p_employee_id, '91484496-b887-44f7-9e5d-be9db5567604'::uuid)
  );

  RAISE NOTICE '✅ تم إنشاء سجل ai_orders بنجاح';

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'extracted_data', jsonb_build_object(
      'phone', v_phone,
      'city', v_city_name,
      'region', v_region_name,
      'landmark', v_landmark,
      'address', v_address,
      'items', v_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_total_amount + v_delivery_fee
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;