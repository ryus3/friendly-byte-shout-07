-- تحديث دالة process_telegram_order لإضافة معامل employee_id وحفظ created_by
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_chat_id bigint,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_products jsonb;
  v_city_result record;
  v_address text;
  v_phone text;
  v_total_amount numeric := 0;
  v_ai_order_id uuid;
  v_employee_id uuid;
  v_all_products_available boolean := true;
  v_alternatives_message text := '';
  v_item jsonb;
BEGIN
  RAISE NOTICE '🤖 معالجة طلب تليغرام: %', p_message_text;
  
  -- تحديد employee_id: إما من المعامل أو من telegram_chat_id
  IF p_employee_id IS NOT NULL THEN
    v_employee_id := p_employee_id;
    RAISE NOTICE '✅ استخدام employee_id المُمرر: %', v_employee_id;
  ELSIF p_chat_id IS NOT NULL THEN
    -- البحث عن الموظف من telegram_chat_id
    SELECT user_id INTO v_employee_id
    FROM public.employee_telegram_codes
    WHERE telegram_chat_id = p_chat_id
      AND is_active = true
    LIMIT 1;
    
    IF v_employee_id IS NOT NULL THEN
      RAISE NOTICE '✅ تم العثور على employee_id من chat_id: %', v_employee_id;
    ELSE
      RAISE NOTICE '⚠️ لم يتم العثور على موظف لـ chat_id: %', p_chat_id;
    END IF;
  END IF;
  
  -- استخراج المنتجات
  v_products := extract_product_items_from_text(p_message_text);
  
  -- التحقق من توفر المنتجات وحساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_products)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_all_products_available := false;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', '');
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;
  
  -- إذا كانت المنتجات غير متوفرة، إرجاع رسالة البدائل
  IF NOT v_all_products_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_available', false,
      'alternatives_message', v_alternatives_message,
      'needs_city_selection', false
    );
  END IF;
  
  -- البحث الذكي عن المدينة
  SELECT * INTO v_city_result FROM smart_search_city(p_message_text) LIMIT 1;
  
  -- استخراج العنوان ورقم الهاتف
  v_address := extract_actual_address(p_message_text);
  v_phone := extractphonefromtext(p_message_text);
  
  -- إنشاء سجل AI order
  INSERT INTO public.ai_orders (
    items,
    total_amount,
    original_text,
    telegram_chat_id,
    customer_phone,
    customer_address,
    city_id,
    customer_city,
    status,
    created_by,
    processed_at,
    order_data
  ) VALUES (
    v_products,
    v_total_amount,
    p_message_text,
    p_chat_id,
    v_phone,
    v_address,
    v_city_result.city_id,
    v_city_result.city_name,
    'pending',
    v_employee_id,  -- حفظ employee_id في created_by
    now(),
    jsonb_build_object(
      'city_found', v_city_result.city_id IS NOT NULL,
      'city_confidence', COALESCE(v_city_result.confidence, 0),
      'phone_found', v_phone IS NOT NULL AND v_phone != 'غير محدد',
      'address_found', v_address IS NOT NULL AND v_address != 'لم يُحدد',
      'employee_id', v_employee_id
    )
  ) RETURNING id INTO v_ai_order_id;
  
  RAISE NOTICE '✅ تم إنشاء AI order: % بواسطة: %', v_ai_order_id, v_employee_id;
  
  -- تحديد ما إذا كانت هناك حاجة لاختيار المدينة
  IF v_city_result.city_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'ai_order_id', v_ai_order_id,
      'needs_city_selection', true,
      'is_available', true,
      'products', v_products,
      'total_amount', v_total_amount,
      'phone', v_phone,
      'address', v_address,
      'employee_id', v_employee_id
    );
  END IF;
  
  -- إرجاع النتيجة الكاملة
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'needs_city_selection', false,
    'is_available', true,
    'city', jsonb_build_object(
      'id', v_city_result.city_id,
      'name', v_city_result.city_name,
      'confidence', v_city_result.confidence
    ),
    'products', v_products,
    'total_amount', v_total_amount,
    'phone', v_phone,
    'address', v_address,
    'employee_id', v_employee_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'is_available', false,
      'needs_city_selection', false
    );
END;
$function$;