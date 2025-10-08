-- استعادة extract_product_items_from_text الصحيحة (بمعاملين)
CREATE OR REPLACE FUNCTION public.extract_product_items_from_text(
  input_text text,
  p_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_line text;
  v_items jsonb := '[]'::jsonb;
  v_product_name text;
  v_quantity integer;
  v_product record;
  v_variant record;
  v_item jsonb;
  v_can_view_all boolean := false;
  v_alternative_product record;
  v_alternative_variant record;
BEGIN
  -- التحقق من صلاحيات الموظف
  IF p_employee_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = p_employee_id
        AND p.name = 'view_all_products'
        AND ur.is_active = true
    ) INTO v_can_view_all;
  END IF;

  v_lines := string_to_array(input_text, E'\n');
  
  FOREACH v_line IN ARRAY v_lines
  LOOP
    v_line := TRIM(v_line);
    CONTINUE WHEN v_line = '' OR v_line IS NULL;
    
    -- نمط: "اسم المنتج +العدد" أو "اسم المنتج + العدد"
    IF v_line ~* '\+\s*\d+' THEN
      v_product_name := TRIM(regexp_replace(v_line, '\+.*$', ''));
      v_quantity := (regexp_match(v_line, '\+\s*(\d+)'))[1]::integer;
    ELSE
      CONTINUE;
    END IF;

    -- البحث عن المنتج
    SELECT p.id, p.name, p.price, p.cost_price, p.is_active
    INTO v_product
    FROM products p
    WHERE lower(p.name) = lower(v_product_name)
      AND p.is_active = true
      AND (v_can_view_all OR p.created_by = p_employee_id OR p.created_by IS NULL)
    LIMIT 1;

    IF v_product.id IS NOT NULL THEN
      -- البحث عن variant افتراضي
      SELECT pv.id, pv.price, pv.cost_price
      INTO v_variant
      FROM product_variants pv
      WHERE pv.product_id = v_product.id
        AND pv.quantity > 0
      ORDER BY pv.is_default DESC NULLS LAST, pv.quantity DESC
      LIMIT 1;

      v_item := jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'variant_id', v_variant.id,
        'quantity', v_quantity,
        'price', COALESCE(v_variant.price, v_product.price, 0),
        'cost_price', COALESCE(v_variant.cost_price, v_product.cost_price, 0),
        'total_price', COALESCE(v_variant.price, v_product.price, 0) * v_quantity,
        'found', true
      );

      v_items := v_items || jsonb_build_array(v_item);
    ELSE
      -- البحث عن بديل ذكي
      SELECT p.id, p.name, p.price, p.cost_price
      INTO v_alternative_product
      FROM products p
      WHERE p.is_active = true
        AND (v_can_view_all OR p.created_by = p_employee_id OR p.created_by IS NULL)
        AND (
          lower(p.name) LIKE '%' || lower(v_product_name) || '%'
          OR lower(v_product_name) LIKE '%' || lower(p.name) || '%'
        )
      ORDER BY 
        CASE WHEN lower(p.name) LIKE lower(v_product_name) || '%' THEN 1 ELSE 2 END,
        length(p.name)
      LIMIT 1;

      IF v_alternative_product.id IS NOT NULL THEN
        SELECT pv.id, pv.price, pv.cost_price
        INTO v_alternative_variant
        FROM product_variants pv
        WHERE pv.product_id = v_alternative_product.id
          AND pv.quantity > 0
        ORDER BY pv.is_default DESC NULLS LAST, pv.quantity DESC
        LIMIT 1;

        v_item := jsonb_build_object(
          'product_id', v_alternative_product.id,
          'product_name', v_alternative_product.name,
          'variant_id', v_alternative_variant.id,
          'quantity', v_quantity,
          'price', COALESCE(v_alternative_variant.price, v_alternative_product.price, 0),
          'cost_price', COALESCE(v_alternative_variant.cost_price, v_alternative_product.cost_price, 0),
          'total_price', COALESCE(v_alternative_variant.price, v_alternative_product.price, 0) * v_quantity,
          'found', true,
          'is_alternative', true,
          'original_name', v_product_name
        );

        v_items := v_items || jsonb_build_array(v_item);
      ELSE
        v_item := jsonb_build_object(
          'product_name', v_product_name,
          'quantity', v_quantity,
          'found', false,
          'price', 0,
          'total_price', 0
        );

        v_items := v_items || jsonb_build_array(v_item);
      END IF;
    END IF;
  END LOOP;

  RETURN v_items;
END;
$function$;

-- استعادة process_telegram_order الصحيحة (7 معاملات)
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_city_id integer,
  p_region_id integer,
  p_city_name text,
  p_region_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_order_data jsonb;
  v_items jsonb;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_item jsonb;
  v_ai_order_id uuid;
  v_lines text[];
  v_first_line text;
  v_city_keywords text[] := ARRAY['بغداد', 'البصرة', 'النجف', 'كربلاء', 'الموصل', 'أربيل', 'السليمانية', 'ديالى', 'الأنبار', 'ذي قار', 'المثنى', 'القادسية', 'بابل', 'واسط', 'صلاح الدين', 'كركوك', 'نينوى', 'دهوك', 'ميسان'];
BEGIN
  -- الحصول على user_id من employee_code
  SELECT user_id INTO v_employee_id
  FROM public.telegram_employee_codes
  WHERE employee_code = p_employee_code
    AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_code_not_found',
      'message', 'رمز الموظف غير موجود أو غير نشط'
    );
  END IF;

  v_order_data := jsonb_build_object(
    'raw_message', p_message_text,
    'city_id', p_city_id,
    'region_id', p_region_id,
    'city_name', p_city_name,
    'region_name', p_region_name
  );

  -- استخراج اسم العميل بذكاء (تجنب أسماء المدن)
  v_lines := string_to_array(p_message_text, E'\n');
  v_first_line := COALESCE(NULLIF(TRIM(v_lines[1]), ''), 'زبون تليغرام');
  
  v_customer_name := v_first_line;
  FOREACH v_first_line IN ARRAY v_city_keywords
  LOOP
    IF lower(v_customer_name) LIKE '%' || lower(v_first_line) || '%' THEN
      v_customer_name := 'زبون تليغرام';
      EXIT;
    END IF;
  END LOOP;

  v_customer_phone := public.extractphonefromtext(p_message_text);
  v_customer_address := public.extract_actual_address(p_message_text);

  -- استخراج المنتجات باستخدام الدالة الصحيحة
  v_items := public.extract_product_items_from_text(p_message_text, v_employee_id);
  
  -- حساب المجموع
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إنشاء ai_order
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    resolved_city_name,
    city_id,
    region_id,
    resolved_region_name,
    items,
    total_amount,
    delivery_fee,
    order_data,
    status,
    source,
    created_by,
    processed_by
  ) VALUES (
    p_telegram_chat_id,
    p_message_text,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    p_city_name,
    p_city_name,
    p_city_id,
    p_region_id,
    p_region_name,
    v_items,
    v_total_amount,
    v_delivery_fee,
    v_order_data,
    'pending',
    'telegram',
    v_employee_id::text,
    v_employee_id
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'city', p_city_name,
    'region', p_region_name,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'items_count', jsonb_array_length(v_items),
    'items', v_items,
    'message', 'تم استلام الطلب بنجاح ✅' || E'\n' ||
               'العميل: ' || v_customer_name || E'\n' ||
               'الهاتف: ' || v_customer_phone || E'\n' ||
               'العنوان: ' || v_customer_address || E'\n' ||
               'المدينة: ' || p_city_name || ' - ' || p_region_name || E'\n' ||
               'المنتجات: ' || jsonb_array_length(v_items)::text || E'\n' ||
               'المجموع: ' || v_total_amount::text || ' دينار'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;