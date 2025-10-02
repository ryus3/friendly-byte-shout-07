-- إضافة city_id و region_id إلى جدول ai_orders (إن لم يكونا موجودين)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_orders' 
    AND column_name = 'city_id'
  ) THEN
    ALTER TABLE public.ai_orders ADD COLUMN city_id integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_orders' 
    AND column_name = 'region_id'
  ) THEN
    ALTER TABLE public.ai_orders ADD COLUMN region_id integer;
  END IF;
END $$;

-- تحديث دالة process_telegram_order لاستخدام smart_search_city
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_name text := 'غير محدد';
  v_customer_phone text;
  v_customer_city text := NULL;
  v_customer_address text;
  v_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_ai_order_id uuid;
  v_default_customer_name text := NULL;
  v_lines text[];
  v_line text;
  v_city_found boolean := false;
  v_city_raw text := NULL;
  v_city_id integer := NULL;
  v_city_confidence numeric := 0;
  v_search_result record;
BEGIN
  -- البحث عن الموظف
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ رمز الموظف غير صحيح أو غير مفعل'
    );
  END IF;

  -- جلب اسم العميل الافتراضي
  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_employee_id;

  -- إذا كان موجوداً، استخدمه
  IF v_default_customer_name IS NOT NULL AND v_default_customer_name <> '' THEN
    v_customer_name := v_default_customer_name;
  END IF;

  -- استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);

  -- جلب رسوم التوصيل من الإعدادات
  SELECT COALESCE(value::numeric, 5000) INTO v_delivery_fee
  FROM public.settings
  WHERE key = 'default_delivery_fee';

  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(p_message_text, E'\n');

  -- البحث عن المدينة باستخدام smart_search_city
  FOREACH v_line IN ARRAY v_lines
  LOOP
    -- تجاهل الأسطر الفارغة والأسطر التي تحتوي على رقم هاتف
    IF trim(v_line) = '' OR v_line ~ '07[0-9]{9}' THEN
      CONTINUE;
    END IF;

    -- البحث عن المدينة باستخدام smart_search_city
    SELECT city_id, city_name, confidence 
    INTO v_search_result
    FROM smart_search_city(trim(v_line))
    ORDER BY confidence DESC
    LIMIT 1;

    -- إذا وجدنا مدينة بثقة عالية (> 0.7)
    IF v_search_result.city_id IS NOT NULL AND v_search_result.confidence >= 0.7 THEN
      v_city_id := v_search_result.city_id;
      v_customer_city := v_search_result.city_name;
      v_city_confidence := v_search_result.confidence;
      v_city_found := true;
      v_city_raw := trim(v_line);
      EXIT; -- توقف عند أول مدينة صحيحة
    END IF;
  END LOOP;

  -- إذا لم نجد مدينة، نستخدم أول سطر غير فارغ كعنوان
  IF NOT v_city_found THEN
    FOREACH v_line IN ARRAY v_lines
    LOOP
      IF trim(v_line) <> '' AND v_line !~ '07[0-9]{9}' THEN
        v_city_raw := trim(v_line);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- العنوان هو السطر الذي يحتوي على المدينة
  v_customer_address := COALESCE(v_city_raw, 'غير محدد');

  -- استخراج المنتجات
  v_items := extract_product_items_from_text(p_message_text);

  -- إذا لم يتم العثور على منتجات
  IF jsonb_array_length(v_items) = 0 OR (v_items->0->>'is_available')::boolean = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', COALESCE(v_items->0->>'alternatives_message', '❌ لم يتم التعرف على أي منتج')
    );
  END IF;

  -- حساب المبلغ الإجمالي
  SELECT SUM((item->>'total_price')::numeric) INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item
  WHERE (item->>'is_available')::boolean = true;

  -- إضافة رسوم التوصيل
  v_total_amount := v_total_amount + v_delivery_fee;

  -- إنشاء سجل ai_order
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    items,
    total_amount,
    delivery_fee,
    status,
    source,
    created_by,
    city_id,
    resolved_city_name,
    location_confidence
  ) VALUES (
    p_telegram_chat_id,
    p_message_text,
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_address,
    v_items,
    v_total_amount,
    v_delivery_fee,
    'pending',
    'telegram',
    v_employee_id::text,
    v_city_id,
    v_customer_city,
    v_city_confidence
  ) RETURNING id INTO v_ai_order_id;

  -- بناء رسالة النجاح
  RETURN jsonb_build_object(
    'success', true,
    'message', format(
      E'✅ تم استلام الطلب!\n\n🔹 %s\n📍 %s\n📱 الهاتف: %s\n%s💵 المبلغ الإجمالي: %s د.ع',
      v_customer_name,
      v_customer_address,
      v_customer_phone,
      (
        SELECT string_agg(
          format('❇️ %s (%s) %s × %s', 
            item->>'product_name',
            item->>'color',
            item->>'size',
            item->>'quantity'
          ),
          E'\n'
        )
        FROM jsonb_array_elements(v_items) AS item
        WHERE (item->>'is_available')::boolean = true
      ) || E'\n',
      to_char(v_total_amount, 'FM999,999,999')
    ),
    'ai_order_id', v_ai_order_id,
    'city_detected', v_city_found,
    'city_id', v_city_id,
    'city_confidence', v_city_confidence
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة الطلب'
    );
END;
$function$;