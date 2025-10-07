-- تحسين التعرف على المدن في دالة process_telegram_order
-- التعديل: فحص الكلمة الأولى فقط من السطر الأول بدلاً من السطر الكامل

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_chat_id bigint,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_first_line text;
  v_first_word text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_is_city boolean := false;
  v_default_customer_name text;
BEGIN
  -- استخراج الاسم الافتراضي من إعدادات المستخدم
  SELECT telegram_default_customer_name INTO v_default_customer_name
  FROM telegram_employee_codes
  WHERE user_id = p_employee_id AND is_active = true
  LIMIT 1;

  -- استخدام "زبون تليغرام" كافتراضي إذا لم يكن هناك إعداد مخصص
  v_default_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');

  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(TRIM(p_order_data->>'text'), E'\n');
  
  -- التحقق من وجود أسطر
  IF array_length(v_lines, 1) > 0 THEN
    v_first_line := TRIM(v_lines[1]);
    
    -- استخراج الكلمة الأولى فقط من السطر الأول
    v_first_word := split_part(v_first_line, ' ', 1);
    
    -- التحقق إذا كانت الكلمة الأولى هي مدينة أو مرادف مدينة
    SELECT EXISTS(
      SELECT 1 FROM public.cities_cache 
      WHERE LOWER(name) = LOWER(v_first_word)
         OR LOWER(name_ar) = LOWER(v_first_word)
         OR LOWER(name_en) = LOWER(v_first_word)
      UNION
      SELECT 1 FROM public.city_aliases
      WHERE LOWER(alias_name) = LOWER(v_first_word)
         OR LOWER(normalized_name) = LOWER(v_first_word)
    ) INTO v_is_city;
    
    -- إذا كانت الكلمة الأولى مدينة، استخدم الاسم الافتراضي
    IF v_is_city THEN
      v_customer_name := v_default_customer_name;
      RAISE NOTICE 'تم التعرف على مدينة من الكلمة الأولى: %، استخدام الاسم الافتراضي: %', v_first_word, v_default_customer_name;
    ELSE
      -- إذا لم تكن مدينة، استخدم السطر الأول كاسم
      v_customer_name := v_first_line;
      RAISE NOTICE 'لم يتم التعرف على مدينة، استخدام السطر الأول كاسم: %', v_first_line;
    END IF;
  ELSE
    -- إذا لم توجد أسطر، استخدم الاسم الافتراضي
    v_customer_name := v_default_customer_name;
  END IF;

  -- استخراج رقم الهاتف من النص
  v_customer_phone := extractphonefromtext(p_order_data->>'text');
  
  -- استخراج العنوان من النص (يبحث عن "قرب")
  v_customer_address := extract_actual_address(p_order_data->>'text');

  -- استخراج بيانات المنتجات باستخدام الدالة الموجودة
  DECLARE
    v_extracted_items jsonb;
    v_item jsonb;
    v_total_amount numeric := 0;
    v_items_array jsonb := '[]'::jsonb;
    v_has_unavailable_items boolean := false;
    v_alternatives_message text := '';
  BEGIN
    -- استخراج المنتجات من النص
    v_extracted_items := extract_product_items_from_text(p_order_data->>'text');
    
    -- التحقق من توفر المنتجات وحساب المبلغ الإجمالي
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_extracted_items)
    LOOP
      IF (v_item->>'is_available')::boolean = false THEN
        v_has_unavailable_items := true;
        v_alternatives_message := v_item->>'alternatives_message';
        EXIT; -- إيقاف المعالجة عند أول منتج غير متوفر
      END IF;
      
      v_items_array := v_items_array || jsonb_build_array(v_item);
      v_total_amount := v_total_amount + (v_item->>'total_price')::numeric;
    END LOOP;

    -- إذا كانت هناك منتجات غير متوفرة، نرجع رسالة الخطأ
    IF v_has_unavailable_items THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', v_alternatives_message
      );
    END IF;

    -- إنشاء الطلب في جدول ai_orders
    INSERT INTO public.ai_orders (
      customer_name,
      customer_phone,
      customer_address,
      total_amount,
      items,
      telegram_chat_id,
      processed_by,
      status,
      source,
      original_text,
      order_data
    ) VALUES (
      v_customer_name,
      v_customer_phone,
      v_customer_address,
      v_total_amount,
      v_items_array,
      p_chat_id,
      p_employee_id,
      'pending',
      'telegram',
      p_order_data->>'text',
      p_order_data
    );

    -- إرجاع نجاح العملية
    RETURN jsonb_build_object(
      'success', true,
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_address', v_customer_address,
      'total_amount', v_total_amount,
      'items', v_items_array,
      'message', 'تم إنشاء الطلب بنجاح'
    );
  END;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'خطأ في معالجة طلب تليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', 'حدث خطأ في معالجة طلبك'
    );
END;
$function$;