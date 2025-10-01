-- إصلاح دالة process_telegram_order لقراءة default_customer_name من profiles بدلاً من جدول خاطئ
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_employee_id uuid;
  v_customer_name text := 'زبون تليغرام';
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_city_id integer;
  v_region_id integer;
  v_product_items jsonb;
  v_order_id uuid;
  v_alternatives_message text := '';
  v_default_customer_name text;
BEGIN
  RAISE NOTICE '🔄 معالجة الطلب باستخدام الدالة الذكية الصحيحة...';
  RAISE NOTICE '💬 رسالة جديدة من %: "%"', p_telegram_chat_id, p_message_text;

  -- استخراج معرف الموظف من employee_telegram_codes
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes
  WHERE telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE WARNING '❌ لم يتم العثور على معرف موظف للمحادثة %', p_telegram_chat_id;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'عذراً، لم يتم التعرف على حسابك. يرجى التواصل مع الإدارة.',
      'error', 'employee_not_found'
    );
  END IF;

  RAISE NOTICE '👤 معرف الموظف المستخدم: %', v_employee_id;
  RAISE NOTICE '👤 رمز الموظف المستخدم: %', p_employee_code;

  -- قراءة الاسم الافتراضي من profiles
  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_employee_id
  LIMIT 1;

  -- استخدام الاسم الافتراضي من profiles أو القيمة الافتراضية
  v_customer_name := COALESCE(NULLIF(TRIM(v_default_customer_name), ''), 'زبون تليغرام');

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);

  -- استخراج العنوان
  v_customer_address := extract_actual_address(p_message_text);

  -- استخراج المدينة والمحافظة
  SELECT 
    city_name, 
    province,
    city_id
  INTO v_customer_city, v_customer_province, v_city_id
  FROM smart_extract_city_and_province(p_message_text);

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);

  -- فحص إذا كانت المنتجات متوفرة
  IF jsonb_array_length(v_product_items) > 0 THEN
    IF (v_product_items->0->>'is_available')::boolean = false THEN
      v_alternatives_message := v_product_items->0->>'alternatives_message';
      
      RAISE NOTICE '⚠️ المنتج غير متوفر - الرسالة: %', v_alternatives_message;
      
      RETURN jsonb_build_object(
        'success', false,
        'message', v_alternatives_message,
        'error', 'product_not_available',
        'product_info', v_product_items->0
      );
    END IF;
  ELSE
    RAISE NOTICE '⚠️ لم يتم العثور على منتجات في الرسالة';
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ لم يتم إنشاء طلب!' || E'\n' || 'لم يتم التعرف على أي منتج في الطلب',
      'error', 'no_products_found'
    );
  END IF;

  -- إنشاء الطلب
  INSERT INTO public.orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    total_amount,
    final_amount,
    status,
    source,
    created_by,
    telegram_chat_id
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_city_id,
    v_region_id,
    (v_product_items->0->>'total_price')::numeric,
    (v_product_items->0->>'total_price')::numeric,
    'pending',
    'telegram',
    v_employee_id,
    p_telegram_chat_id
  ) RETURNING id INTO v_order_id;

  -- إضافة عناصر الطلب
  INSERT INTO public.order_items (
    order_id,
    product_id,
    quantity,
    price,
    color,
    size
  )
  SELECT 
    v_order_id,
    (SELECT id FROM products WHERE name = item->>'product_name' LIMIT 1),
    (item->>'quantity')::integer,
    (item->>'price')::numeric,
    item->>'color',
    item->>'size'
  FROM jsonb_array_elements(v_product_items) AS item;

  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح - معرف الطلب: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء الطلب بنجاح',
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'customer_city', v_customer_city,
    'items', v_product_items
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
      'error', SQLERRM
    );
END;
$$;