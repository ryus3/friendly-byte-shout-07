-- Fix variable scope issue in process_telegram_order function
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid;
  v_employee_name text;
  v_customer_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_city_id integer;
  v_city_name text;
  v_region_id integer;
  v_region_name text;
  v_product_items jsonb;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
  v_order_data jsonb;
  v_ai_order_id uuid;
BEGIN
  -- التحقق من صحة رمز الموظف
  SELECT user_id INTO v_user_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code 
    AND is_active = true;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- الحصول على اسم الموظف
  SELECT COALESCE(full_name, email, id::text) INTO v_employee_name
  FROM auth.users
  WHERE id = v_user_id;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  
  IF v_customer_phone = 'غير محدد' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم العثور على رقم هاتف صحيح في الرسالة'
    );
  END IF;

  -- البحث الذكي عن المدينة
  SELECT city_id, city_name INTO v_city_id, v_city_name
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على المدينة'
    );
  END IF;

  -- استخراج المنطقة
  v_region_name := extract_actual_address(p_message_text);

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);

  -- التحقق من المنتجات وحساب المجموع
  IF jsonb_array_length(v_product_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب'
    );
  END IF;

  -- حساب المجموع والتحقق من التوفر
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_message := v_item->>'alternatives_message';
      EXIT;
    END IF;
    v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
  END LOOP;

  -- إذا كانت هناك منتجات غير متوفرة، نرجع رسالة الخطأ
  IF v_has_unavailable THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_alternatives_message
    );
  END IF;

  -- بناء بيانات الطلب
  v_order_data := jsonb_build_object(
    'customer_phone', v_customer_phone,
    'customer_name', v_customer_name,
    'customer_city', v_city_name,
    'customer_address', v_region_name,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'source', 'telegram',
    'created_by', v_employee_name,
    'telegram_chat_id', p_telegram_chat_id,
    'original_text', p_message_text
  );

  -- إدراج الطلب في ai_orders
  INSERT INTO public.ai_orders (
    customer_phone,
    customer_name,
    customer_city,
    customer_address,
    city_id,
    region_id,
    items,
    total_amount,
    source,
    created_by,
    telegram_chat_id,
    original_text,
    order_data,
    status
  ) VALUES (
    v_customer_phone,
    v_customer_name,
    v_city_name,
    v_region_name,
    v_city_id,
    v_region_id,
    v_product_items,
    v_total_amount,
    'telegram',
    v_employee_name,
    p_telegram_chat_id,
    p_message_text,
    v_order_data,
    'pending'
  )
  RETURNING id INTO v_ai_order_id;

  -- بناء رسالة النجاح
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'message', format(
      E'✅ تم استلام الطلب!\n\n' ||
      E'📍 %s - %s\n' ||
      E'📱 الهاتف: %s\n' ||
      E'%s' ||
      E'💵 المبلغ الإجمالي: %s د.ع',
      v_city_name,
      v_region_name,
      v_customer_phone,
      (
        SELECT string_agg(
          format(E'❇️ %s (%s) %s × %s', 
            item->>'product_name',
            item->>'color',
            item->>'size',
            item->>'quantity'
          ),
          E'\n'
        )
        FROM jsonb_array_elements(v_product_items) item
      ),
      to_char(v_total_amount, 'FM999,999,999')
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM
    );
END;
$function$;