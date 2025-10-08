-- إصلاح دالة process_telegram_order - حساب المبلغ الإجمالي بشكل صحيح
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id bigint,
  p_original_text text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_city text,
  p_customer_province text DEFAULT NULL,
  p_customer_address text DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 5000,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_resolved_city_name text DEFAULT NULL,
  p_resolved_region_name text DEFAULT NULL,
  p_location_confidence numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ai_order_id uuid;
  v_order_id uuid;
  v_customer_id uuid;
  v_variant_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_price numeric;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_employee_id uuid;
  v_extracted_items jsonb;
  v_extraction_result jsonb;
BEGIN
  -- البحث عن الموظف المرتبط برقم المحادثة
  SELECT tec.user_id
  INTO v_employee_id
  FROM public.telegram_employee_codes tec
  WHERE tec.telegram_chat_id = p_telegram_chat_id
    AND tec.is_active = true
  LIMIT 1;

  -- إذا لم يُعثر على موظف، رفض الطلب
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على موظف مرتبط بهذه المحادثة'
    );
  END IF;

  -- استخراج العناصر من النص إذا لم يتم تمريرها
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    -- استدعاء دالة الاستخراج
    SELECT public.extract_product_items_from_text(p_original_text) INTO v_extraction_result;
    
    -- التحقق من نجاح الاستخراج
    IF v_extraction_result->>'success' = 'false' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', COALESCE(v_extraction_result->>'error', 'فشل استخراج المنتجات من النص')
      );
    END IF;
    
    v_extracted_items := v_extraction_result->'items';
  ELSE
    v_extracted_items := p_items;
  END IF;

  -- التحقق من وجود عناصر
  IF v_extracted_items IS NULL OR jsonb_array_length(v_extracted_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لم يتم العثور على منتجات في الطلب'
    );
  END IF;

  -- إنشاء أو تحديث العميل
  INSERT INTO public.customers (name, phone, city, province, address, created_by)
  VALUES (
    COALESCE(p_customer_name, 'زبون تليغرام'),
    p_customer_phone,
    p_customer_city,
    p_customer_province,
    p_customer_address,
    v_employee_id
  )
  ON CONFLICT (phone, created_by) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, customers.name),
      city = COALESCE(EXCLUDED.city, customers.city),
      province = COALESCE(EXCLUDED.province, customers.province),
      address = COALESCE(EXCLUDED.address, customers.address),
      updated_at = now()
  RETURNING id INTO v_customer_id;

  -- إنشاء طلب AI أولاً
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    delivery_fee,
    items,
    notes,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    location_confidence,
    status,
    source,
    created_by,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    p_original_text,
    p_customer_name,
    p_customer_phone,
    p_customer_city,
    p_customer_province,
    p_customer_address,
    p_delivery_fee,
    v_extracted_items,
    p_notes,
    p_city_id,
    p_region_id,
    p_resolved_city_name,
    p_resolved_region_name,
    p_location_confidence,
    'approved',
    'telegram',
    v_employee_id::text,
    jsonb_build_object(
      'auto_processed', true,
      'processed_at', now()
    )
  )
  RETURNING id INTO v_ai_order_id;

  -- حساب المبلغ الإجمالي من العناصر - FIX: استخدام price * quantity بدلاً من total_price
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_extracted_items)
  LOOP
    v_total_amount := v_total_amount + ((v_item->>'price')::numeric * (v_item->>'quantity')::numeric);
  END LOOP;

  -- إضافة رسوم التوصيل
  v_total_amount := v_total_amount + COALESCE(p_delivery_fee, 0);

  -- إنشاء الطلب الفعلي
  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    total_amount,
    final_amount,
    delivery_fee,
    status,
    notes,
    created_by,
    source
  ) VALUES (
    v_customer_id,
    p_customer_name,
    p_customer_phone,
    p_customer_city,
    p_customer_province,
    p_customer_address,
    v_total_amount,
    v_total_amount,
    p_delivery_fee,
    'pending',
    p_notes,
    v_employee_id,
    'telegram'
  )
  RETURNING id INTO v_order_id;

  -- ربط طلب AI بالطلب الفعلي
  UPDATE public.ai_orders
  SET related_order_id = v_order_id,
      processed_by = v_employee_id,
      processed_at = now()
  WHERE id = v_ai_order_id;

  -- إضافة عناصر الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_extracted_items)
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    v_price := (v_item->>'price')::numeric;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      quantity,
      price,
      total
    ) VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_quantity,
      v_price,
      v_price * v_quantity
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'ai_order_id', v_ai_order_id,
    'customer_id', v_customer_id,
    'total_amount', v_total_amount,
    'items_count', jsonb_array_length(v_extracted_items)
  );
END;
$function$;