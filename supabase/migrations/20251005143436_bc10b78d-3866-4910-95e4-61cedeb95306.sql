-- إصلاح نهائي لدالة process_telegram_order
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id BIGINT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_customer_city TEXT,
  p_customer_province TEXT,
  p_items JSONB,
  p_total_amount NUMERIC,
  p_delivery_fee NUMERIC,
  p_original_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
  v_employee_name TEXT;
  v_default_customer_name TEXT;
  v_order_id UUID;
  v_customer_id UUID;
  v_customer_name TEXT;
  v_order_number TEXT;
BEGIN
  -- البحث عن الموظف المرتبط بالتليغرام
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;

  -- الحصول على الاسم الكامل واسم الزبون الافتراضي من البروفايل
  IF v_employee_id IS NOT NULL THEN
    SELECT 
      COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'المدير العام'),
      COALESCE(NULLIF(TRIM(p.default_customer_name), ''), 'ريوس')
    INTO v_employee_name, v_default_customer_name
    FROM public.profiles p
    WHERE p.id = v_employee_id;
  END IF;

  -- القيم الافتراضية إذا لم يتم العثور على الموظف
  v_employee_id := COALESCE(v_employee_id, '91484496-b887-44f7-9e5d-be9db5567604'::uuid);
  v_employee_name := COALESCE(v_employee_name, 'المدير العام');
  v_default_customer_name := COALESCE(v_default_customer_name, 'ريوس');

  -- استخدام اسم الزبون الافتراضي إذا كان الاسم المُرسل فارغاً
  v_customer_name := COALESCE(NULLIF(TRIM(p_customer_name), ''), v_default_customer_name);

  -- إنشاء أو الحصول على الزبون
  INSERT INTO public.customers (name, phone, address, city, province, created_by)
  VALUES (
    v_customer_name,
    p_customer_phone,
    p_customer_address,
    p_customer_city,
    p_customer_province,
    v_employee_id
  )
  ON CONFLICT (phone) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, customers.name),
    address = COALESCE(EXCLUDED.address, customers.address),
    city = COALESCE(EXCLUDED.city, customers.city),
    province = COALESCE(EXCLUDED.province, customers.province),
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- توليد رقم الطلب
  v_order_number := 'ORD-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- إنشاء الطلب
  INSERT INTO public.orders (
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    final_amount,
    delivery_fee,
    status,
    source,
    created_by,
    notes
  ) VALUES (
    v_order_number,
    v_customer_id,
    v_customer_name,
    p_customer_phone,
    p_customer_address,
    p_customer_city,
    p_customer_province,
    p_total_amount,
    p_total_amount + COALESCE(p_delivery_fee, 0),
    COALESCE(p_delivery_fee, 0),
    'pending',
    'telegram',
    v_employee_name,  -- تخزين اسم الموظف الكامل
    'طلب تليغرام: ' || COALESCE(p_original_text, '')
  )
  RETURNING id INTO v_order_id;

  -- إضافة عناصر الطلب
  INSERT INTO public.order_items (
    order_id,
    product_id,
    variant_id,
    quantity,
    price,
    total_price
  )
  SELECT
    v_order_id,
    (item->>'product_id')::uuid,
    (item->>'variant_id')::uuid,
    (item->>'quantity')::integer,
    (item->>'price')::numeric,
    (item->>'total_price')::numeric
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'employee_name', v_employee_name,
    'customer_name', v_customer_name
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;