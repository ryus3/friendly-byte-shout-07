-- تحديث دالة process_telegram_order لدعم مرادفات المدن
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_input_text text,
  p_telegram_chat_id bigint,
  p_employee_code text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_address text DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_name text := p_customer_name;
  v_customer_phone text := p_customer_phone;
  v_customer_address text := p_customer_address;
  v_delivery_fee numeric := p_delivery_fee;
  v_products_json jsonb;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_order_id uuid;
  v_lines text[];
  v_first_line text;
  v_is_city boolean := false;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليجرام';
  RAISE NOTICE '📝 النص المدخل: %', p_input_text;
  RAISE NOTICE '💬 Chat ID: %', p_telegram_chat_id;
  RAISE NOTICE '👤 كود الموظف: %', COALESCE(p_employee_code, 'غير محدد');

  -- التحقق من كود الموظف والحصول على user_id
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_employee_id 
    FROM public.employee_telegram_codes 
    WHERE telegram_code = p_employee_code 
      AND is_active = true 
    LIMIT 1;
    
    IF v_employee_id IS NULL THEN
      RAISE NOTICE '⚠️ كود الموظف غير صالح: %', p_employee_code;
      RETURN jsonb_build_object(
        'success', false,
        'error', 'invalid_employee_code',
        'message', 'كود الموظف غير صالح أو غير نشط'
      );
    END IF;
    
    RAISE NOTICE '✅ تم التحقق من الموظف: %', v_employee_id;
  END IF;

  -- استخراج اسم الزبون من السطر الأول (إذا لم يُمرر كمعامل)
  IF v_customer_name IS NULL AND p_input_text IS NOT NULL THEN
    v_lines := string_to_array(TRIM(p_input_text), E'\n');
    
    IF array_length(v_lines, 1) > 0 THEN
      v_first_line := TRIM(v_lines[1]);
      
      -- فحص إذا كان السطر الأول اسم مدينة أو مرادف مدينة
      SELECT EXISTS(
        SELECT 1 FROM public.cities_cache 
        WHERE LOWER(name) = LOWER(v_first_line) 
           OR LOWER(name_ar) = LOWER(v_first_line)
           OR LOWER(name_en) = LOWER(v_first_line)
        UNION
        SELECT 1 FROM public.city_aliases
        WHERE LOWER(alias_name) = LOWER(v_first_line)
           OR LOWER(normalized_name) = LOWER(v_first_line)
      ) INTO v_is_city;
      
      -- إذا لم يكن اسم مدينة، نستخدمه كاسم زبون
      IF NOT v_is_city AND length(v_first_line) > 2 AND v_first_line !~ '^[0-9]+$' THEN
        v_customer_name := v_first_line;
        RAISE NOTICE '👤 تم استخراج اسم الزبون من السطر الأول: %', v_customer_name;
      ELSE
        RAISE NOTICE '🏙️ السطر الأول هو اسم مدينة: %', v_first_line;
      END IF;
    END IF;
  END IF;

  -- استخدام الاسم الافتراضي إذا لم يُحدد
  v_customer_name := COALESCE(NULLIF(v_customer_name, ''), 'زبون تليجرام');

  -- استخراج رقم الهاتف
  IF v_customer_phone IS NULL THEN
    v_customer_phone := public.extractphonefromtext(p_input_text);
  END IF;

  -- استخراج العنوان
  IF v_customer_address IS NULL THEN
    v_customer_address := public.extract_actual_address(p_input_text);
  END IF;

  -- استخراج المنتجات
  v_products_json := public.extract_product_items_from_text(p_input_text);
  
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_products_json;

  -- التحقق من وجود منتجات غير متوفرة
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_products_json)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      RAISE NOTICE '❌ المنتج غير متوفر: %', v_item->>'product_name';
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', v_item->>'alternatives_message',
        'unavailable_product', v_item
      );
    END IF;
    
    v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
  END LOOP;

  -- إضافة رسوم التوصيل
  v_total_amount := v_total_amount + v_delivery_fee;

  -- إنشاء سجل في جدول ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    delivery_fee,
    items,
    telegram_chat_id,
    processed_by,
    original_text,
    status,
    source,
    created_by
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_total_amount,
    v_delivery_fee,
    v_products_json,
    p_telegram_chat_id,
    v_employee_id,
    p_input_text,
    'pending',
    'telegram',
    COALESCE(v_employee_id::text, 'telegram')
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح: %', v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'items', v_products_json,
    'message', 'تم إنشاء الطلب بنجاح'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة الطلب',
      'details', SQLERRM
    );
END;
$function$;