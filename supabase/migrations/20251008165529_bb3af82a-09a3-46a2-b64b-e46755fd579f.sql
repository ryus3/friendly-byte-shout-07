-- إصلاح دالة process_telegram_order: تصحيح created_by وإضافة logging
DROP FUNCTION IF EXISTS public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer,
  p_region_id integer,
  p_city_name text,
  p_region_name text
);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_region_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_items jsonb;
  v_order_id uuid;
  v_customer_address text := 'لم يُحدد';
BEGIN
  RAISE NOTICE '🤖 بدء معالجة طلب تليغرام - الموظف: %, الرسالة: %', p_employee_code, p_message_text;

  -- الحصول على user_id من كود الموظف
  SELECT user_id INTO v_user_id
  FROM telegram_employee_codes
  WHERE employee_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ كود موظف غير صالح: %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صالح أو غير نشط',
      'employee_code', p_employee_code
    );
  END IF;

  RAISE NOTICE '✅ تم العثور على المستخدم: %', v_user_id;

  -- استخراج اسم العميل ورقم الهاتف من النص
  v_customer_name := COALESCE(
    NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), ''),
    'زبون تليغرام'
  );
  
  v_customer_phone := extractphonefromtext(p_message_text);

  RAISE NOTICE '📞 اسم العميل: %, رقم الهاتف: %', v_customer_name, v_customer_phone;

  -- استخراج عنوان العميل إذا كان موجوداً
  v_customer_address := extract_actual_address(p_message_text);

  -- استخراج المنتجات من النص
  v_items := extract_product_items_from_text(p_message_text);

  IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
    RAISE NOTICE '❌ لم يتم العثور على منتجات صالحة في النص';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على منتجات صالحة في الرسالة'
    );
  END IF;

  RAISE NOTICE '📦 تم استخراج % منتج', jsonb_array_length(v_items);

  -- إنشاء الطلب الذكي
  v_order_id := gen_random_uuid();

  RAISE NOTICE '📝 سيتم الحفظ مع created_by: % (من v_user_id: %)', v_user_id::text, v_user_id;

  INSERT INTO ai_orders (
    id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    items,
    original_text,
    telegram_chat_id,
    source,
    status,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_order_id,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    COALESCE(p_city_name, 'غير محدد'),
    'غير محدد',
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    v_items,
    p_message_text,
    p_telegram_chat_id,
    'telegram',
    'pending',
    v_user_id::text,  -- ✅ التصحيح الرئيسي: استخدام v_user_id بدلاً من p_employee_code
    now(),
    now()
  );

  RAISE NOTICE '✅ تم إنشاء الطلب الذكي بنجاح - Order ID: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'items_count', jsonb_array_length(v_items),
    'city_name', p_city_name,
    'region_name', p_region_name,
    'user_id', v_user_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % - %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;