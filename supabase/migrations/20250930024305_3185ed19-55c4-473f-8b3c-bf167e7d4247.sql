-- Update process_telegram_order function to return complete data for bot response
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text DEFAULT 'EMP0001',
  p_chat_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ai_order_id uuid;
  v_user_id uuid;
  v_customer_phone text;
  v_customer_name text;
  v_customer_city text;
  v_customer_address text;
  v_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000; -- رسوم التوصيل الافتراضية
  v_found_city text;
  v_found_region text;
  v_final_address text;
  v_landmark text;
  v_final_amount numeric := 0;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام بالكود: %', p_employee_code;
  
  -- استخراج البيانات من الـ JSON
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_name := p_order_data->>'customer_name';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_address := p_order_data->>'customer_address';
  v_items := p_order_data->'items';
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);
  
  -- حساب المبلغ النهائي مع رسوم التوصيل
  v_final_amount := v_total_amount + v_delivery_fee;
  
  -- البحث عن المستخدم بالكود
  SELECT tc.user_id INTO v_user_id
  FROM public.telegram_employee_codes tc
  WHERE tc.employee_code = p_employee_code
    AND tc.is_active = true
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على موظف بالكود: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مربوط'
    );
  END IF;
  
  RAISE NOTICE '✅ تم العثور على الموظف: %', v_user_id;
  
  -- استخراج المدينة والمنطقة من العنوان
  v_found_city := COALESCE(v_customer_city, 'غير محدد');
  v_found_region := COALESCE(SPLIT_PART(v_customer_address, '-', 2), 'غير محدد');
  v_landmark := COALESCE(SPLIT_PART(v_customer_address, '-', 3), '');
  v_final_address := TRIM(v_customer_address);
  
  -- إنشاء الطلب الذكي
  INSERT INTO public.ai_orders (
    customer_phone,
    customer_name,
    customer_city,
    customer_address,
    items,
    total_amount,
    order_data,
    telegram_chat_id,
    status,
    created_by
  ) VALUES (
    v_customer_phone,
    v_customer_name,
    v_found_city,
    v_final_address,
    v_items,
    v_final_amount, -- المبلغ مع رسوم التوصيل
    p_order_data,
    p_chat_id,
    'pending',
    'telegram'
  )
  RETURNING id INTO v_ai_order_id;
  
  RAISE NOTICE '✅ تم إنشاء الطلب الذكي: %', v_ai_order_id;
  
  -- إرجاع النتيجة الكاملة مع جميع البيانات المطلوبة
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'user_id', v_user_id,
    'customer_city', v_found_city,
    'customer_region', v_found_region,
    'customer_phone', v_customer_phone,
    'customer_address', v_final_address,
    'landmark', v_landmark,
    'items', v_items,
    'final_amount', v_final_amount,
    'delivery_fee', v_delivery_fee,
    'message', 'تم حفظ الطلب بنجاح مع معالجة ذكية للعنوان'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة طلبك'
    );
END;
$function$;