-- إضافة العمود source إذا لم يكن موجوداً
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- تحديث الدالة لتعمل بدون العمود source إذا لم يكن موجوداً
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_items jsonb,
  p_employee_code text,
  p_total_amount numeric DEFAULT 0,
  p_delivery_fee numeric DEFAULT 0,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product_variant record;
  v_total_calculated numeric := 0;
  v_delivery_fee_final numeric := COALESCE(p_delivery_fee, 5000);
  v_customer_city text;
  v_customer_province text;
BEGIN
  RAISE NOTICE 'بدء معالجة طلب تليغرام - الموظف: %, العميل: %', p_employee_code, p_customer_name;
  
  -- البحث عن الموظف باستخدام employee_code من جدول telegram_employee_codes
  SELECT tec.user_id INTO v_employee_id
  FROM public.telegram_employee_codes tec
  WHERE tec.employee_code = p_employee_code 
    AND tec.is_active = true
    AND tec.telegram_chat_id IS NOT NULL;

  IF v_employee_id IS NULL THEN
    RAISE NOTICE 'خطأ: لم يتم العثور على الموظف برمز %', p_employee_code;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مربوط',
      'employee_code', p_employee_code
    );
  END IF;

  RAISE NOTICE 'تم العثور على الموظف: %', v_employee_id;

  -- استخراج المدينة والمحافظة من العنوان
  v_customer_city := TRIM(SPLIT_PART(p_customer_address, ',', 1));
  v_customer_province := TRIM(SPLIT_PART(p_customer_address, ',', 2));
  
  IF v_customer_province = '' THEN
    v_customer_province := v_customer_city;
  END IF;

  -- البحث عن العميل أو إنشاؤه
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = p_customer_phone
    AND created_by = v_employee_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      p_customer_name, p_customer_phone, p_customer_address, 
      v_customer_city, v_customer_province, v_employee_id
    ) RETURNING id INTO v_customer_id;
    
    RAISE NOTICE 'تم إنشاء عميل جديد: %', v_customer_id;
  ELSE
    RAISE NOTICE 'تم العثور على عميل موجود: %', v_customer_id;
  END IF;

  -- حساب المجموع الإجمالي من العناصر
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT pv.*, p.name as product_name
    INTO v_product_variant
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = (v_item->>'variant_id')::uuid;

    IF v_product_variant IS NOT NULL THEN
      v_total_calculated := v_total_calculated + 
        (COALESCE((v_item->>'quantity')::integer, 1) * COALESCE(v_product_variant.price, 0));
      
      RAISE NOTICE 'تمت إضافة منتج: % - الكمية: % - السعر: %', 
        v_product_variant.product_name, 
        COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE(v_product_variant.price, 0);
    END IF;
  END LOOP;

  -- إنشاء رقم طلب فريد
  v_order_number := 'TG-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
    LPAD(EXTRACT(EPOCH FROM NOW())::text, 6, '0');

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
    notes,
    created_by
  ) VALUES (
    v_order_number,
    v_customer_id,
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    v_customer_city,
    v_customer_province,
    v_total_calculated,
    v_total_calculated + v_delivery_fee_final,
    v_delivery_fee_final,
    'pending',
    'telegram',
    COALESCE(p_notes, 'طلب من التليغرام'),
    v_employee_id
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE 'تم إنشاء الطلب: % برقم: %', v_order_id, v_order_number;

  -- إضافة عناصر الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT pv.*, p.name as product_name
    INTO v_product_variant
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.id = (v_item->>'variant_id')::uuid;

    IF v_product_variant IS NOT NULL THEN
      INSERT INTO public.order_items (
        order_id,
        product_id,
        variant_id,
        quantity,
        unit_price,
        total_price
      ) VALUES (
        v_order_id,
        v_product_variant.product_id,
        v_product_variant.id,
        COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE(v_product_variant.price, 0),
        COALESCE((v_item->>'quantity')::integer, 1) * COALESCE(v_product_variant.price, 0)
      );
      
      RAISE NOTICE 'تمت إضافة عنصر الطلب: %', v_product_variant.product_name;
    END IF;
  END LOOP;

  -- إنشاء سجل في ai_orders للطلبات الذكية
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    items,
    order_data,
    source,
    status,
    related_order_id,
    processed_by,
    processed_at,
    created_by
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    v_customer_city,
    v_customer_province,
    v_total_calculated + v_delivery_fee_final,
    p_items,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'employee_code', p_employee_code,
      'delivery_fee', v_delivery_fee_final
    ),
    'telegram',
    'processed',
    v_order_id,
    v_employee_id,
    NOW(),
    p_employee_code
  );

  RAISE NOTICE 'تم إنشاء سجل ai_orders للطلب';

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'total_amount', v_total_calculated + v_delivery_fee_final,
    'message', 'تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة الطلب: % - %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', 'فشل في معالجة الطلب: ' || SQLERRM,
      'employee_code', p_employee_code
    );
END;
$$;