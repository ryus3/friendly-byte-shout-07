-- ============================================
-- الإصلاح الجذري النهائي لدالة process_telegram_order
-- ============================================

-- 1️⃣ حذف النسخة القديمة الخاطئة
DROP FUNCTION IF EXISTS public.process_telegram_order(
  text, text, bigint, integer, integer, text, text
);

-- 2️⃣ إنشاء النسخة الصحيحة بالكامل
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
  v_employee_id uuid;
  v_employee_name text;
  v_default_customer_name text;
  v_product_items jsonb;
  v_customer_name text;
  v_customer_phone text;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_ai_order_id uuid;
  v_customer_address text;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
  v_item jsonb;
BEGIN
  -- الحصول على معرف الموظف من الكود
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'كود الموظف غير صالح أو غير نشط'
    );
  END IF;

  -- ✅ إصلاح 1: الحصول على الاسم الكامل من profiles بدلاً من email
  SELECT 
    COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'المدير العام'),
    COALESCE(NULLIF(TRIM(p.default_customer_name), ''), 'ريوس')
  INTO v_employee_name, v_default_customer_name
  FROM public.profiles p
  WHERE p.id = v_employee_id;

  -- استخراج رقم الهاتف
  v_customer_phone := public.extractphonefromtext(p_message_text);

  -- استخراج العنوان
  v_customer_address := public.extract_actual_address(p_message_text);

  -- إنشاء العنوان الكامل
  IF p_city_name IS NOT NULL AND p_region_name IS NOT NULL THEN
    v_customer_address := p_city_name || ' - ' || p_region_name;
  END IF;

  -- استخراج المنتجات
  v_product_items := public.extract_product_items_from_text(p_message_text);

  -- التحقق من توفر المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_message := v_item->>'alternatives_message';
      EXIT;
    END IF;
    v_total_amount := v_total_amount + ((v_item->>'total_price')::numeric);
  END LOOP;

  -- إذا كانت هناك منتجات غير متوفرة، نرجع رسالة البدائل
  IF v_has_unavailable THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_unavailable',
      'alternatives_message', v_alternatives_message
    );
  END IF;

  -- ✅ إصلاح 2: استخدام v_default_customer_name ('ريوس') كافتراضي
  v_customer_name := COALESCE(
    NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), ''),
    v_default_customer_name
  );

  -- إضافة رسوم التوصيل
  v_total_amount := v_total_amount + v_delivery_fee;

  -- ✅ إصلاح 3: استخدام v_employee_name (الاسم الكامل) في created_by
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    processed_by,
    items,
    total_amount,
    delivery_fee,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    source,
    status,
    created_by,
    original_text,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    v_employee_id,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    p_city_name,
    NULL,
    p_city_id,
    p_region_id,
    p_city_name,
    p_region_name,
    'telegram',
    'pending',
    v_employee_name,  -- ✅ استخدام الاسم الكامل بدلاً من UUID
    p_message_text,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'telegram_chat_id', p_telegram_chat_id,
      'processed_at', now()
    )
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'total_amount', v_total_amount,
    'items', v_product_items,
    'customer_name', v_customer_name,
    'created_by', v_employee_name
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة طلب تليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب',
      'details', SQLERRM
    );
END;
$$;

-- 3️⃣ تحديث السجلات القديمة في ai_orders
-- تحديث created_by من email إلى الاسم الكامل
UPDATE public.ai_orders ao
SET 
  created_by = COALESCE(
    NULLIF(TRIM(p.full_name), ''),
    p.email,
    'المدير العام'
  ),
  updated_at = now()
FROM public.profiles p
WHERE ao.source = 'telegram'
  AND ao.processed_by = p.id
  AND (ao.created_by LIKE '%@%' OR ao.created_by IS NULL);

-- تحديث customer_name من 'زبون تليغرام' إلى الاسم الافتراضي
UPDATE public.ai_orders ao
SET 
  customer_name = COALESCE(
    NULLIF(TRIM(p.default_customer_name), ''),
    'ريوس'
  ),
  updated_at = now()
FROM public.profiles p
WHERE ao.source = 'telegram'
  AND ao.processed_by = p.id
  AND (ao.customer_name = 'زبون تليغرام' OR ao.customer_name IS NULL);

-- 4️⃣ رسالة تأكيد
DO $$
BEGIN
  RAISE NOTICE '✅ تم الإصلاح الجذري بنجاح:';
  RAISE NOTICE '  - تم حذف النسخة القديمة من process_telegram_order';
  RAISE NOTICE '  - تم إنشاء النسخة الصحيحة التي تستخدم الاسم الكامل';
  RAISE NOTICE '  - تم تحديث جميع السجلات القديمة';
  RAISE NOTICE '  - created_by الآن يستخدم "المدير العام" بدلاً من الإيميل';
  RAISE NOTICE '  - customer_name الآن يستخدم "ريوس" كافتراضي';
END $$;