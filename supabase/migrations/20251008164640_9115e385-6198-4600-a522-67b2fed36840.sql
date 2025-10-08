-- إصلاح دالة process_telegram_order مع logging محسّن ومعالجة أخطاء شاملة

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_original_text text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_items jsonb,
  p_telegram_chat_id bigint,
  p_employee_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_ai_order_id uuid;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_item jsonb;
  v_city text;
  v_province text;
BEGIN
  RAISE NOTICE '🔹 بدء معالجة طلب تليغرام - Chat ID: %, Employee Code: %', p_telegram_chat_id, p_employee_code;
  
  -- البحث عن معرف المستخدم من رمز الموظف
  SELECT user_id INTO v_user_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ لم يتم العثور على موظف بالرمز: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على المستخدم: % للموظف: %', v_user_id, p_employee_code;

  -- استخراج المدينة والمحافظة من العنوان
  v_city := COALESCE(NULLIF(TRIM(SPLIT_PART(p_customer_address, '-', 2)), ''), 'غير محدد');
  v_province := COALESCE(NULLIF(TRIM(SPLIT_PART(p_customer_address, '-', 1)), ''), 'غير محدد');

  RAISE NOTICE '📍 تم استخراج الموقع - المحافظة: %, المدينة: %', v_province, v_city;

  -- حساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_amount := v_total_amount + 
      COALESCE((v_item->>'price')::numeric, 0) * 
      COALESCE((v_item->>'quantity')::integer, 1);
  END LOOP;

  RAISE NOTICE '💰 المبلغ الإجمالي المحسوب: % (عدد المنتجات: %)', 
    v_total_amount, jsonb_array_length(p_items);

  -- إنشاء سجل ai_order
  BEGIN
    INSERT INTO public.ai_orders (
      original_text,
      customer_name,
      customer_phone,
      customer_address,
      customer_city,
      customer_province,
      items,
      total_amount,
      delivery_fee,
      telegram_chat_id,
      created_by,
      source,
      status
    ) VALUES (
      p_original_text,
      p_customer_name,
      p_customer_phone,
      p_customer_address,
      v_city,
      v_province,
      p_items,
      v_total_amount,
      v_delivery_fee,
      p_telegram_chat_id,
      v_user_id::text,  -- ✅ إصلاح: استخدام v_user_id بدلاً من p_employee_code
      'telegram',
      'pending'
    )
    RETURNING id INTO v_ai_order_id;

    RAISE NOTICE '✅ تم حفظ الطلب بنجاح - AI Order ID: %', v_ai_order_id;
    RAISE NOTICE '📊 تفاصيل الطلب المحفوظ:';
    RAISE NOTICE '   - العميل: % (هاتف: %)', p_customer_name, p_customer_phone;
    RAISE NOTICE '   - العنوان: %', p_customer_address;
    RAISE NOTICE '   - المبلغ: %', v_total_amount;
    RAISE NOTICE '   - created_by: %', v_user_id::text;

    RETURN jsonb_build_object(
      'success', true,
      'ai_order_id', v_ai_order_id,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'items_count', jsonb_array_length(p_items),
      'message', 'تم حفظ الطلب بنجاح'
    );

  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '❌ خطأ صلاحيات RLS - المستخدم: %, Employee Code: %', v_user_id, p_employee_code;
      RAISE NOTICE '❌ التفاصيل: %', SQLERRM;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'rls_violation',
        'error_detail', SQLERRM,
        'message', 'خطأ في الصلاحيات - تواصل مع الدعم الفني'
      );
    
    WHEN OTHERS THEN
      RAISE NOTICE '❌ خطأ غير متوقع في حفظ الطلب:';
      RAISE NOTICE '   - SQLSTATE: %', SQLSTATE;
      RAISE NOTICE '   - SQLERRM: %', SQLERRM;
      RAISE NOTICE '   - User ID: %', v_user_id;
      RAISE NOTICE '   - Employee Code: %', p_employee_code;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'database_error',
        'error_code', SQLSTATE,
        'error_detail', SQLERRM,
        'message', 'حدث خطأ في حفظ الطلب'
      );
  END;
END;
$$;