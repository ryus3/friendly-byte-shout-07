-- حذف النسخة المتضاربة من process_telegram_order التي تستقبل input_text
DROP FUNCTION IF EXISTS public.process_telegram_order(input_text text, chat_id bigint);

-- التأكد من وجود النسخة الصحيحة فقط
-- إذا لم تكن موجودة، سنعيد إنشاءها
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb, 
  p_employee_code text, 
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_customer_phone text;
  v_customer_name text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_city_id integer;
  v_region_id integer;
  v_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_employee_id uuid;
  v_success boolean := true;
  v_error_message text := '';
BEGIN
  RAISE NOTICE '🔄 معالجة طلب تليغرام بالنسخة العاملة - الموظف: % - المحادثة: %', p_employee_code, p_chat_id;

  -- Get employee ID from employee code
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes 
  WHERE telegram_code = p_employee_code AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على الموظف للرمز: %', p_employee_code;
    v_employee_id := '91484496-b887-44f7-9e5d-be9db5567604'::uuid; -- Default admin
  END IF;

  -- Extract data from the structured input
  v_customer_phone := COALESCE(p_order_data->>'customer_phone', '');
  v_customer_name := COALESCE(p_order_data->>'customer_name', 'عميل تليغرام');
  v_customer_address := public.extract_actual_address(COALESCE(p_order_data->>'customer_address', ''));
  v_customer_city := COALESCE(p_order_data->>'customer_city', '');
  v_customer_province := COALESCE(p_order_data->>'customer_province', '');
  v_city_id := COALESCE((p_order_data->>'city_id')::integer, NULL);
  v_region_id := COALESCE((p_order_data->>'region_id')::integer, NULL);
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);
  v_total_amount := COALESCE((p_order_data->>'total_amount')::numeric, 0);

  -- Get delivery fee from settings
  BEGIN
    SELECT COALESCE((value)::numeric, 5000) INTO v_delivery_fee 
    FROM public.settings 
    WHERE key = 'delivery_fee' 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_delivery_fee := 5000;
  END;

  RAISE NOTICE '📦 منتجات الطلب: %', v_items;
  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;

  -- Check if all items are available
  IF jsonb_array_length(v_items) > 0 THEN
    DECLARE
      v_item jsonb;
    BEGIN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
      LOOP
        IF COALESCE((v_item->>'is_available')::boolean, false) = false THEN
          v_success := false;
          v_error_message := COALESCE(v_item->>'alternatives_message', 'منتج غير متوفر');
          RAISE NOTICE '❌ منتج غير متوفر: %', v_item->>'product_name';
          
          RETURN jsonb_build_object(
            'success', false,
            'error', v_error_message,
            'items', v_items,
            'total_amount', v_total_amount,
            'delivery_fee', v_delivery_fee,
            'customer_phone', v_customer_phone
          );
        END IF;
      END LOOP;
    END;
  ELSE
    v_success := false;
    v_error_message := 'لم يتم العثور على منتجات صالحة في الطلب';
  END IF;

  -- Create order if all items are available
  IF v_success AND v_total_amount > 0 THEN
    INSERT INTO public.ai_orders (
      customer_phone,
      customer_name,
      customer_address,
      customer_city,
      customer_province,
      city_id,
      region_id,
      telegram_chat_id,
      items,
      total_amount,
      original_text,
      source,
      status,
      order_data,
      created_by
    ) VALUES (
      v_customer_phone,
      v_customer_name,
      v_customer_address,
      v_customer_city,
      v_customer_province,
      v_city_id,
      v_region_id,
      p_chat_id,
      v_items,
      v_total_amount,
      COALESCE(p_order_data->>'original_text', ''),
      'telegram',
      'pending',
      jsonb_build_object(
        'delivery_fee', v_delivery_fee,
        'total_with_delivery', v_total_amount + v_delivery_fee,
        'employee_id', v_employee_id
      ),
      v_employee_id
    ) RETURNING id INTO v_order_id;

    RAISE NOTICE '✅ تم إنشاء الطلب بنجاح: %', v_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', v_success,
    'error', COALESCE(v_error_message, ''),
    'items', v_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'customer_phone', v_customer_phone,
    'order_id', v_order_id,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'order_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', v_customer_city,
      'customer_province', v_customer_province,
      'customer_address', v_customer_address,
      'city_id', v_city_id,
      'region_id', v_region_id,
      'items', v_items,
      'total_amount', v_total_amount,
      'created_by', v_employee_id
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'items', COALESCE(v_items, '[]'::jsonb),
      'total_amount', 0,
      'delivery_fee', v_delivery_fee,
      'customer_phone', COALESCE(v_customer_phone, '')
    );
END;
$function$;