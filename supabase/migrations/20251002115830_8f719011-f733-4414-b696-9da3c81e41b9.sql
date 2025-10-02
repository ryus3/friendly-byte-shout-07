-- تحديث دالة process_telegram_order لاستخدام resolve-location-with-ai مع التعلم الذكي

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code TEXT,
  p_message_text TEXT,
  p_telegram_chat_id BIGINT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_employee_id UUID;
  v_customer_phone TEXT;
  v_customer_name TEXT := 'زبون تليغرام';
  v_customer_city TEXT;
  v_customer_address TEXT;
  v_delivery_fee NUMERIC := 5000;
  v_items JSONB;
  v_total_amount NUMERIC := 0;
  v_order_id UUID;
  v_ai_order_id UUID;
  v_message TEXT := '';
  v_product_items JSONB;
  v_item JSONB;
  v_has_unavailable BOOLEAN := false;
  v_alternatives_msg TEXT := '';
  
  -- متغيرات حل الموقع بالذكاء الاصطناعي
  v_location_result JSONB;
  v_city_id INTEGER;
  v_region_id INTEGER;
  v_resolved_city_name TEXT;
  v_resolved_region_name TEXT;
  v_location_confidence NUMERIC;
  v_location_suggestions JSONB;
  v_used_learning BOOLEAN;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام';
  RAISE NOTICE '📝 النص المستلم: %', p_message_text;
  RAISE NOTICE '👤 رمز الموظف: %', p_employee_code;

  -- الحصول على معرف الموظف
  IF p_employee_code IS NOT NULL AND p_employee_code <> '' THEN
    SELECT user_id INTO v_employee_id
    FROM public.employee_telegram_codes
    WHERE telegram_code = p_employee_code
      AND is_active = true
    LIMIT 1;
    
    RAISE NOTICE '👤 معرف الموظف: %', v_employee_id;
  END IF;

  -- 1️⃣ استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_customer_phone;

  -- 2️⃣ استخراج المنتجات باستخدام الدالة الذكية
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 عناصر المنتج المستخرجة: %', v_product_items;

  -- التحقق من توفر المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_msg := v_item->>'alternatives_message';
      EXIT;
    END IF;
    v_total_amount := v_total_amount + ((v_item->>'total_price')::numeric);
  END LOOP;

  -- إذا كان هناك منتجات غير متوفرة، نرجع رسالة البدائل مباشرة
  IF v_has_unavailable THEN
    RAISE NOTICE '⚠️ منتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'message', v_alternatives_msg
    );
  END IF;

  v_items := v_product_items;
  v_total_amount := v_total_amount + v_delivery_fee;

  -- 3️⃣ استخراج الموقع (المدينة والمنطقة) باستخدام الذكاء الاصطناعي مع التعلم
  RAISE NOTICE '🌍 استخراج الموقع باستخدام AI...';
  
  -- استدعاء edge function للحصول على الموقع بذكاء
  BEGIN
    SELECT content::jsonb INTO v_location_result
    FROM http((
      'POST',
      current_setting('app.settings.supabase_url') || '/functions/v1/resolve-location-with-ai',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key'))
      ],
      'application/json',
      jsonb_build_object('location_text', p_message_text)::text
    ));
    
    -- استخراج النتائج
    v_city_id := (v_location_result->>'city_id')::integer;
    v_region_id := (v_location_result->>'region_id')::integer;
    v_resolved_city_name := v_location_result->>'city_name';
    v_resolved_region_name := v_location_result->>'region_name';
    v_location_confidence := (v_location_result->>'confidence')::numeric;
    v_location_suggestions := v_location_result->'suggestions';
    v_used_learning := (v_location_result->>'used_learning')::boolean;
    
    RAISE NOTICE '✅ نتيجة AI: city_id=%, region_id=%, city=%, region=%, confidence=%, used_learning=%', 
      v_city_id, v_region_id, v_resolved_city_name, v_resolved_region_name, v_location_confidence, v_used_learning;
    
    -- الحصول على اسم المدينة للعنوان
    IF v_resolved_city_name IS NOT NULL THEN
      v_customer_city := v_resolved_city_name;
      IF v_resolved_region_name IS NOT NULL THEN
        v_customer_address := v_resolved_city_name || ', ' || v_resolved_region_name;
      ELSE
        v_customer_address := v_resolved_city_name;
      END IF;
    ELSE
      v_customer_city := 'غير محدد';
      v_customer_address := 'غير محدد';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ خطأ في استدعاء AI: %', SQLERRM;
    -- في حالة الفشل، نستخدم قيم افتراضية
    v_city_id := NULL;
    v_region_id := NULL;
    v_resolved_city_name := NULL;
    v_resolved_region_name := NULL;
    v_customer_city := 'غير محدد';
    v_customer_address := 'غير محدد';
    v_location_confidence := 0;
    v_location_suggestions := '[]'::jsonb;
    v_used_learning := false;
  END;

  -- 4️⃣ حفظ الطلب في ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    location_confidence,
    location_suggestions,
    items,
    total_amount,
    delivery_fee,
    status,
    source,
    created_by,
    order_data
  ) VALUES (
    p_telegram_chat_id,
    p_message_text,
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_address,
    v_city_id,
    v_region_id,
    v_resolved_city_name,
    v_resolved_region_name,
    v_location_confidence,
    v_location_suggestions,
    v_items,
    v_total_amount,
    v_delivery_fee,
    'pending',
    'telegram',
    COALESCE(v_employee_id::text, 'telegram'),
    jsonb_build_object(
      'raw_text', p_message_text,
      'employee_code', p_employee_code,
      'used_ai_learning', v_used_learning
    )
  ) RETURNING id INTO v_ai_order_id;

  RAISE NOTICE '✅ تم حفظ الطلب في ai_orders بمعرف: %', v_ai_order_id;

  -- 5️⃣ بناء رسالة النجاح
  v_message := '✅ تم استلام طلبك بنجاح!' || E'\n\n';
  v_message := v_message || '📦 المنتجات:' || E'\n';
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_message := v_message || '• ' || (v_item->>'product_name') || 
                ' - ' || (v_item->>'color') || 
                ' - ' || (v_item->>'size') ||
                ' × ' || (v_item->>'quantity') || E'\n';
  END LOOP;
  
  v_message := v_message || E'\n📍 الموقع: ' || v_customer_address;
  
  IF v_used_learning THEN
    v_message := v_message || ' ✨ (تم التعرف باستخدام التعلم السابق)';
  END IF;
  
  v_message := v_message || E'\n📱 الهاتف: ' || v_customer_phone;
  v_message := v_message || E'\n💰 المبلغ الإجمالي: ' || v_total_amount || ' IQD';
  v_message := v_message || E'\n\n⏳ سيتم مراجعة طلبك قريباً';

  RETURN jsonb_build_object(
    'success', true,
    'message', v_message,
    'ai_order_id', v_ai_order_id,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'city_name', v_resolved_city_name,
    'region_name', v_resolved_region_name,
    'confidence', v_location_confidence,
    'used_learning', v_used_learning
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '⚠️ عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.'
    );
END;
$$;