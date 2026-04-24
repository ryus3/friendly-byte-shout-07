-- 1) Update process_telegram_order to accept explicit phone overrides
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_telegram_chat_id bigint,
  p_employee_code text,
  p_message_text text,
  p_city_id integer DEFAULT NULL::integer,
  p_region_id integer DEFAULT NULL::integer,
  p_city_name text DEFAULT NULL::text,
  p_region_name text DEFAULT NULL::text,
  p_customer_phone_override text DEFAULT NULL::text,
  p_customer_phone2_override text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_id uuid;
  v_product_items jsonb;
  v_customer_phone text;
  v_customer_phone2 text;
  v_phone_data jsonb;
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

  SELECT default_customer_name INTO v_default_customer_name
  FROM public.profiles
  WHERE user_id = v_employee_id;

  v_default_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');
  v_original_text := p_message_text;

  v_lines := string_to_array(p_message_text, E'\n');
  FOREACH v_line IN ARRAY v_lines LOOP
    IF v_line ~* '^\s*(ملاحظة|ملاحظه)\s*:?\s*' THEN
      v_notes := TRIM(regexp_replace(v_line, '^\s*(ملاحظة|ملاحظه)\s*:?\s*', '', 'i'));
      EXIT;
    END IF;
  END LOOP;

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

  -- ✅ Phone extraction with override priority (multi-layer defense)
  v_phone_data := extractphonefromtext(p_message_text);
  v_customer_phone := COALESCE(NULLIF(TRIM(p_customer_phone_override), ''), v_phone_data->>'primary');
  v_customer_phone2 := COALESCE(NULLIF(TRIM(p_customer_phone2_override), ''), v_phone_data->>'secondary');

  v_customer_address := extract_actual_address(p_message_text);

  v_product_items := extract_product_items_from_text(p_message_text);

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

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    v_calculated_amount := v_calculated_amount + (v_item->>'total_price')::numeric;
  END LOOP;

  v_calculated_amount := v_calculated_amount + v_delivery_fee;

  v_written_amount := extract_total_amount_from_text(p_message_text);

  IF v_written_amount IS NOT NULL THEN
    v_price_adjustment := v_written_amount - v_calculated_amount;
    IF v_price_adjustment < 0 THEN
      v_adjustment_type := 'discount';
    ELSIF v_price_adjustment > 0 THEN
      v_adjustment_type := 'markup';
    ELSE
      v_adjustment_type := NULL;
    END IF;
  ELSE
    v_written_amount := v_calculated_amount;
    v_price_adjustment := 0;
    v_adjustment_type := NULL;
  END IF;

  INSERT INTO public.ai_orders (
    telegram_chat_id, items, total_amount, written_total_amount,
    calculated_total_amount, price_adjustment, adjustment_type,
    order_data, processed_by, city_id, region_id, delivery_fee,
    customer_name, customer_phone, customer_phone2, customer_address,
    source, status, created_by, customer_city, customer_province,
    original_text, resolved_city_name, resolved_region_name, notes
  ) VALUES (
    p_telegram_chat_id, v_product_items, v_written_amount, v_written_amount,
    v_calculated_amount, v_price_adjustment, v_adjustment_type,
    jsonb_build_object(
      'employee_code', p_employee_code,
      'message_text', p_message_text,
      'customer_phone', v_customer_phone,
      'customer_phone2', v_customer_phone2,
      'customer_address', v_customer_address
    ),
    v_employee_id, p_city_id, p_region_id, v_delivery_fee,
    v_customer_name, v_customer_phone, v_customer_phone2, v_customer_address,
    'telegram', 'pending', v_employee_id::text, p_city_name, p_region_name,
    v_original_text, p_city_name, p_region_name, v_notes
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_phone2', v_customer_phone2,
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
      WHEN v_adjustment_type = 'markup'   THEN '✅ تم إنشاء الطلب بزيادة ' || v_price_adjustment::text
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
$function$;

-- 2) Cleanup duplicate new_ai_order notifications (keep most informative per ai_order_id + user_id scope)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY (data->>'ai_order_id'), COALESCE(user_id::text, '__GLOBAL__')
      ORDER BY
        CASE WHEN title LIKE '%طلب ذكي جديد من%' THEN 0 ELSE 1 END,
        created_at DESC
    ) AS rn
  FROM public.notifications
  WHERE type = 'new_ai_order'
    AND (data ? 'ai_order_id')
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id AND r.rn > 1;

-- 3) Idempotency guard: prevent future duplicates for the same ai_order + recipient scope
CREATE UNIQUE INDEX IF NOT EXISTS uniq_new_ai_order_per_user
  ON public.notifications ((data->>'ai_order_id'), COALESCE(user_id::text, '__GLOBAL__'))
  WHERE type = 'new_ai_order' AND (data ? 'ai_order_id');
