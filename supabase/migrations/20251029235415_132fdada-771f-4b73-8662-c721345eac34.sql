-- ========================================
-- المرحلة 1: حذف جميع النسخ المكررة
-- ========================================
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, bigint, integer, integer, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, text, integer, integer, text, text) CASCADE;

-- ========================================
-- المرحلة 2: إعادة إنشاء الدالة الأصلية + دعم رقمين
-- ========================================
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id bigint,
  p_employee_code text,
  p_message_text text,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_region_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee_id uuid;
  v_product_items jsonb;
  v_customer_phone text;
  v_secondary_phone text;  -- ✅ تعديل 1: إضافة متغير للرقم الثاني
  v_phone_data jsonb;      -- ✅ تعديل 1: إضافة متغير للبيانات
  v_customer_address text;
  v_delivery_fee numeric := 5000;
  v_calculated_amount numeric := 0;
  v_written_amount numeric := NULL;
  v_price_adjustment numeric := 0;
  v_adjustment_type text := NULL;
  v_item jsonb;
  v_order_id uuid;
  v_customer_name text;
  v_default_customer_name text := 'زبون تليغرام';
  v_first_line text;
  v_first_word text;
  v_is_city boolean := false;
  v_original_text text;
  v_notes text := NULL;
  v_lines text[];
  v_line text;
BEGIN
  -- التحقق من وجود الموظف
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', '❌ رمز الموظف غير صحيح أو غير نشط'
    );
  END IF;

  -- الحصول على اسم الزبون الافتراضي
  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_employee_id;
  
  v_default_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');
  v_original_text := p_message_text;

  -- استخراج الملاحظات
  v_lines := string_to_array(p_message_text, E'\n');
  FOREACH v_line IN ARRAY v_lines LOOP
    IF v_line ~* '^\s*(ملاحظة|ملاحظه)\s*:?\s*' THEN
      v_notes := TRIM(regexp_replace(v_line, '^\s*(ملاحظة|ملاحظه)\s*:?\s*', '', 'i'));
      EXIT;
    END IF;
  END LOOP;

  -- استخراج اسم الزبون
  v_first_line := TRIM(SPLIT_PART(p_message_text, E'\n', 1));
  v_first_word := TRIM(SPLIT_PART(v_first_line, ' ', 1));

  SELECT EXISTS(
    SELECT 1 FROM public.cities_cache 
    WHERE LOWER(v_first_word) = LOWER(name)
       OR LOWER(v_first_word) = LOWER(name_ar)
       OR LOWER(v_first_word) = LOWER(name_en)
  ) INTO v_is_city;

  IF NOT v_is_city THEN
    SELECT EXISTS(
      SELECT 1 FROM public.city_aliases
      WHERE LOWER(v_first_word) = LOWER(alias_name)
    ) INTO v_is_city;
  END IF;

  IF v_is_city THEN
    v_customer_name := v_default_customer_name;
  ELSIF v_first_line IS NOT NULL AND v_first_line != '' THEN
    v_customer_name := v_first_line;
  ELSE
    v_customer_name := v_default_customer_name;
  END IF;

  -- ✅ تعديل 2: استخراج رقمين هاتف
  v_phone_data := extractphonefromtext(p_message_text);
  v_customer_phone := v_phone_data->>'primary';
  v_secondary_phone := v_phone_data->>'secondary';
  v_customer_address := extract_actual_address(p_message_text);

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);

  -- التحقق من المنتجات غير المتوفرة
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_product_items) item
    WHERE (item->>'is_available')::boolean = false
  ) THEN
    DECLARE
      v_alternatives_message text;
    BEGIN
      SELECT item->>'alternatives_message' INTO v_alternatives_message
      FROM jsonb_array_elements(v_product_items) item
      WHERE (item->>'is_available')::boolean = false
      LIMIT 1;

      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_unavailable',
        'message', v_alternatives_message,
        'alternatives', v_product_items
      );
    END;
  END IF;

  -- حساب المبلغ الإجمالي المحسوب تلقائياً
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_calculated_amount := v_calculated_amount + (v_item->>'total_price')::numeric;
  END LOOP;
  
  v_calculated_amount := v_calculated_amount + v_delivery_fee;

  RAISE NOTICE '💰 المبلغ المحسوب تلقائياً: %', v_calculated_amount;

  -- استخراج المبلغ المكتوب من النص
  v_written_amount := extract_total_amount_from_text(p_message_text);
  
  IF v_written_amount IS NOT NULL THEN
    -- حساب الفرق (التعديل)
    v_price_adjustment := v_written_amount - v_calculated_amount;
    
    IF v_price_adjustment < 0 THEN
      v_adjustment_type := 'discount';
      RAISE NOTICE '🎁 خصم: %', ABS(v_price_adjustment);
    ELSIF v_price_adjustment > 0 THEN
      v_adjustment_type := 'markup';
      RAISE NOTICE '📈 زيادة: %', v_price_adjustment;
    ELSE
      v_adjustment_type := NULL;
      RAISE NOTICE '✅ المبلغ المكتوب مطابق للمحسوب';
    END IF;
  ELSE
    -- إذا لم يُكتب مبلغ، نستخدم المبلغ المحسوب
    v_written_amount := v_calculated_amount;
    v_price_adjustment := 0;
    v_adjustment_type := NULL;
    RAISE NOTICE 'ℹ️ لا يوجد مبلغ مكتوب - استخدام المبلغ المحسوب';
  END IF;

  -- ✅ تعديل 3: إضافة secondary_phone في INSERT
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    items,
    total_amount,
    written_total_amount,
    calculated_total_amount,
    price_adjustment,
    adjustment_type,
    order_data,
    processed_by,
    city_id,
    region_id,
    delivery_fee,
    customer_name,
    customer_phone,
    secondary_phone,
    customer_address,
    source,
    status,
    created_by,
    customer_city,
    customer_province,
    original_text,
    resolved_city_name,
    resolved_region_name,
    notes
  ) VALUES (
    p_telegram_chat_id,
    v_product_items,
    v_written_amount,
    v_written_amount,
    v_calculated_amount,
    v_price_adjustment,
    v_adjustment_type,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'message_text', p_message_text,
      'customer_phone', v_customer_phone,
      'secondary_phone', v_secondary_phone,
      'customer_address', v_customer_address
    ),
    v_employee_id,
    p_city_id,
    p_region_id,
    v_delivery_fee,
    v_customer_name,
    v_customer_phone,
    v_secondary_phone,
    v_customer_address,
    'telegram',
    'pending',
    v_employee_id::text,
    p_city_name,
    p_region_name,
    v_original_text,
    p_city_name,
    p_region_name,
    v_notes
  ) RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء طلب AI برقم: %', v_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'secondary_phone', v_secondary_phone,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'calculated_amount', v_calculated_amount,
    'written_amount', v_written_amount,
    'total_amount', v_written_amount,
    'price_adjustment', v_price_adjustment,
    'adjustment_type', v_adjustment_type,
    'delivery_fee', v_delivery_fee,
    'notes', v_notes,
    'message', CASE 
      WHEN v_adjustment_type = 'discount' THEN '✅ تم إنشاء الطلب بخصم ' || ABS(v_price_adjustment)::text
      WHEN v_adjustment_type = 'markup' THEN '✅ تم إنشاء الطلب بزيادة ' || v_price_adjustment::text
      ELSE '✅ تم إنشاء الطلب بنجاح'
    END
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة الطلب'
    );
END;
$$;