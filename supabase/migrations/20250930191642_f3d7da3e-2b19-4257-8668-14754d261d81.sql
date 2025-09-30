-- حذف الدالة الخاطئة فقط (التي تبدأ بـ p_message_text)
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, uuid);

-- تعديل الدالة الصحيحة لإضافة حفظ employee_id
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
  v_extracted_items jsonb;
  v_item jsonb;
  v_city_name text := NULL;
  v_city_id integer := NULL;
  v_address text;
  v_phone text;
  v_total_amount numeric := 0;
  v_all_available boolean := true;
  v_alternatives_message text := '';
  v_employee_id uuid := p_employee_id;
BEGIN
  RAISE NOTICE '📥 استلام طلب من chat_id: %', p_chat_id;
  RAISE NOTICE '📝 النص: %', p_message_text;
  RAISE NOTICE '👤 معرف الموظف: %', p_employee_id;

  -- إذا لم يُمرر employee_id، نحاول الحصول عليه من telegram_chat_id
  IF v_employee_id IS NULL THEN
    SELECT user_id INTO v_employee_id
    FROM public.employee_telegram_codes
    WHERE telegram_chat_id = p_chat_id AND is_active = true
    LIMIT 1;
    
    RAISE NOTICE '👤 تم العثور على معرف الموظف من telegram_chat_id: %', v_employee_id;
  END IF;

  -- استخراج المنتجات
  v_extracted_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_extracted_items;

  -- التحقق من توفر جميع المنتجات وحساب الإجمالي
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_extracted_items)
  LOOP
    IF NOT COALESCE((v_item->>'is_available')::boolean, false) THEN
      v_all_available := false;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', 'المنتج غير متوفر');
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- استخراج المدينة
  SELECT city_id, city_name INTO v_city_id, v_city_name
  FROM smart_search_city(p_message_text)
  ORDER BY confidence DESC
  LIMIT 1;

  RAISE NOTICE '🏙️ المدينة المستخرجة: % (ID: %)', v_city_name, v_city_id;

  -- استخراج العنوان ورقم الهاتف
  v_address := extract_actual_address(p_message_text);
  v_phone := extractphonefromtext(p_message_text);

  RAISE NOTICE '📍 العنوان: %', v_address;
  RAISE NOTICE '📱 الهاتف: %', v_phone;

  -- إذا كانت جميع المنتجات غير متوفرة، نرجع رسالة الخطأ
  IF NOT v_all_available THEN
    RAISE NOTICE '❌ المنتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unavailable_products',
      'message', v_alternatives_message,
      'alternatives', v_alternatives_message
    );
  END IF;

  -- إنشاء الطلب في ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    items,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    total_amount,
    status,
    source,
    created_by,
    order_data
  ) VALUES (
    p_chat_id,
    p_message_text,
    v_extracted_items,
    COALESCE((v_extracted_items->0->>'customer_name')::text, 'زبون تليغرام'),
    v_phone,
    v_city_name,
    v_address,
    v_city_id,
    v_total_amount,
    'pending',
    'telegram',
    COALESCE(p_employee_id, v_employee_id),
    jsonb_build_object(
      'city_name', v_city_name,
      'city_id', v_city_id,
      'address', v_address,
      'phone', v_phone,
      'items', v_extracted_items
    )
  );

  RAISE NOTICE '✅ تم إنشاء طلب بنجاح';

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'city_name', COALESCE(v_city_name, 'غير محدد'),
    'city_id', v_city_id,
    'address', v_address,
    'phone', v_phone,
    'items', v_extracted_items,
    'total_amount', v_total_amount,
    'message', 'تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLSTATE,
      'message', SQLERRM
    );
END;
$function$;