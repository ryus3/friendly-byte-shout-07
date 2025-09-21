-- Delete the current broken function
DROP FUNCTION IF EXISTS public.process_telegram_order(text, text, text, jsonb, text);

-- Create the correct function that matches what the Telegram bot sends
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_telegram_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 0;
  v_city_id integer;
  v_region_id integer;
  v_order_number text;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_items jsonb;
BEGIN
  -- Get employee by telegram code
  SELECT tec.user_id INTO v_employee_id
  FROM public.telegram_employee_codes tec
  WHERE tec.telegram_code = p_employee_code
    AND tec.telegram_chat_id = p_telegram_chat_id
    AND tec.is_active = true;

  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مربوط'
    );
  END IF;

  -- Extract customer data from order_data
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_items := p_order_data->'items';

  -- Validate required data
  IF v_customer_name IS NULL OR v_items IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'missing_data',
      'message', 'بيانات العميل أو المنتجات مفقودة'
    );
  END IF;

  -- Try to get city and region IDs from cache
  SELECT cc.alwaseet_id INTO v_city_id
  FROM public.cities_cache cc
  WHERE LOWER(cc.name) = LOWER(v_customer_city)
    OR LOWER(cc.name_ar) = LOWER(v_customer_city)
  LIMIT 1;

  -- Create or get customer
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = v_customer_phone
    AND name = v_customer_name
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      v_customer_name, v_customer_phone, v_customer_address, 
      v_customer_city, v_customer_province, v_employee_id
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- Calculate total amount from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_total_amount := v_total_amount + 
      (COALESCE((v_item->>'quantity')::numeric, 1) * 
       COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0));
  END LOOP;

  -- Generate order number
  v_order_number := 'TG-' || EXTRACT(EPOCH FROM now())::bigint || '-' || 
                   SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8);

  -- Create order
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
    delivery_type,
    source,
    city_id,
    region_id,
    created_by
  ) VALUES (
    v_order_number,
    v_customer_id,
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_customer_city,
    v_customer_province,
    v_total_amount,
    v_total_amount + v_delivery_fee,
    v_delivery_fee,
    'pending',
    CASE WHEN v_customer_address IS NOT NULL AND v_customer_address != '' 
         THEN 'توصيل' ELSE 'محلي' END,
    'telegram',
    v_city_id,
    v_region_id,
    v_employee_id
  ) RETURNING id INTO v_order_id;

  -- Add order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      size,
      color,
      product_barcode
    ) VALUES (
      v_order_id,
      v_item->>'product_name',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0),
      COALESCE((v_item->>'quantity')::numeric, 1) * 
        COALESCE((v_item->>'unit_price')::numeric, (v_item->>'price')::numeric, 0),
      v_item->>'size',
      v_item->>'color',
      v_item->>'barcode'
    );
  END LOOP;

  -- Link with AI order if exists
  UPDATE public.ai_orders
  SET 
    related_order_id = v_order_id,
    status = 'processed',
    processed_by = v_employee_id,
    processed_at = now()
  WHERE telegram_chat_id = p_telegram_chat_id
    AND status = 'pending'
    AND created_at >= now() - interval '1 hour'
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'customer_id', v_customer_id,
    'total_amount', v_total_amount,
    'message', 'تم إنشاء الطلب بنجاح'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'processing_failed',
    'message', 'فشل في معالجة الطلب: ' || SQLERRM
  );
END;
$function$;