-- إصلاح شرط الربط في دالة process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id bigint,
  p_message_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_product_items jsonb;
  v_phone text;
  v_address text;
  v_city_name text;
  v_province_name text;
  v_default_customer_name text;
  v_ai_order_id uuid;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_delivery_fee numeric := 5000;
  v_city_id integer;
  v_region_id integer;
  v_location_confidence numeric := 0;
  v_location_suggestions jsonb := '[]'::jsonb;
BEGIN
  RAISE NOTICE '🔄 معالجة طلب تليغرام من chat_id: %', p_chat_id;
  
  -- الحصول على معلومات الموظف من رمز التليغرام - إصلاح شرط الربط
  SELECT u.user_id, u.email INTO v_employee_id, v_employee_name
  FROM public.employee_telegram_codes tec
  JOIN profiles u ON tec.user_id = u.user_id  -- تم التصحيح من u.id إلى u.user_id
  WHERE tec.telegram_chat_id = p_chat_id
    AND tec.is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على موظف مرتبط بـ chat_id: %', p_chat_id;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم ربط حسابك بنظام التليغرام. الرجاء التواصل مع المدير.'
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على الموظف: % (ID: %)', v_employee_name, v_employee_id;

  -- الحصول على اسم العميل الافتراضي للموظف
  SELECT default_customer_name INTO v_default_customer_name
  FROM profiles
  WHERE user_id = v_employee_id;

  v_default_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');
  RAISE NOTICE '📝 اسم العميل الافتراضي: %', v_default_customer_name;

  -- استخراج المنتجات من النص
  v_product_items := extract_product_items_from_text(p_message_text);
  
  IF v_product_items IS NULL OR jsonb_array_length(v_product_items) = 0 THEN
    RAISE NOTICE '⚠️ لم يتم العثور على منتجات في النص';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم التعرف على أي منتج في طلبك'
    );
  END IF;

  -- حساب المبلغ الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  
  -- استخراج العنوان
  v_address := extract_actual_address(p_message_text);

  -- إنشاء سجل AI order
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    items,
    total_amount,
    delivery_fee,
    order_data,
    source,
    status,
    created_by,
    city_id,
    region_id,
    location_confidence,
    location_suggestions,
    original_text,
    resolved_city_name,
    resolved_region_name
  ) VALUES (
    p_chat_id,
    v_default_customer_name,
    v_phone,
    v_address,
    v_city_name,
    v_province_name,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    jsonb_build_object(
      'employee_id', v_employee_id,
      'employee_name', v_employee_name,
      'message_text', p_message_text
    ),
    'telegram',
    'pending',
    v_employee_id,
    v_city_id,
    v_region_id,
    v_location_confidence,
    v_location_suggestions,
    p_message_text,
    v_city_name,
    v_province_name
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI بنجاح - ID: %', v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_id', v_employee_id,
    'employee_name', v_employee_name,
    'customer_name', v_default_customer_name,
    'phone', v_phone,
    'address', v_address,
    'city', v_city_name,
    'province', v_province_name,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة طلب التليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة طلبك: ' || SQLERRM
    );
END;
$function$;