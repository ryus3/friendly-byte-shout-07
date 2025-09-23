-- Fix process_telegram_order to handle default manager and better error handling
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
  v_order_id uuid;
  v_customer_id uuid;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_order_item_id uuid;
  v_delivery_fee numeric := 0;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_original_text text;
  v_employee_id uuid;
  v_default_manager_id uuid := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
BEGIN
  -- Extract customer info from order data
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_original_text := p_order_data->>'original_text';

  -- Get employee ID from telegram chat
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id AND is_active = true
  LIMIT 1;

  -- Use provided employee_id as fallback
  IF v_employee_id IS NULL THEN
    v_employee_id := p_employee_id;
  END IF;

  -- Use default manager if still no employee found
  IF v_employee_id IS NULL THEN
    v_employee_id := v_default_manager_id;
    RAISE NOTICE 'لم يتم العثور على موظف مرتبط بـ chat_id: %, استخدام المدير الافتراضي', p_chat_id;
  END IF;

  -- Validate required fields
  IF v_customer_name IS NULL OR trim(v_customer_name) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'missing_customer_name',
      'message', 'اسم العميل مطلوب'
    );
  END IF;

  -- Create or get customer
  INSERT INTO public.customers (
    name, phone, address, city, province, created_by
  ) VALUES (
    v_customer_name, v_customer_phone, v_customer_address, 
    v_customer_city, v_customer_province, v_employee_id
  )
  ON CONFLICT (phone) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    city = EXCLUDED.city,
    province = EXCLUDED.province,
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- Calculate total amount
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    v_total_amount := v_total_amount + COALESCE((v_item->>'quantity')::numeric, 1) * COALESCE((v_item->>'unit_price')::numeric, 0);
  END LOOP;

  -- Set delivery fee based on address
  v_delivery_fee := CASE 
    WHEN v_customer_address IS NOT NULL AND trim(v_customer_address) != '' THEN 2500
    ELSE 0
  END;

  -- Create the order
  INSERT INTO public.orders (
    customer_id, customer_name, customer_phone, customer_address, 
    customer_city, customer_province, total_amount, delivery_fee, 
    final_amount, status, delivery_type, created_by, source
  ) VALUES (
    v_customer_id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_province, v_total_amount, v_delivery_fee,
    v_total_amount + v_delivery_fee, 'pending',
    CASE WHEN v_customer_address IS NOT NULL AND trim(v_customer_address) != '' 
         THEN 'توصيل' ELSE 'محلي' END,
    v_employee_id, 'telegram'
  ) 
  RETURNING id INTO v_order_id;

  -- Create order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    INSERT INTO public.order_items (
      order_id, product_name, color, size, quantity, unit_price, total_price
    ) VALUES (
      v_order_id,
      v_item->>'product_name',
      v_item->>'color', 
      v_item->>'size',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'quantity')::integer, 1) * COALESCE((v_item->>'unit_price')::numeric, 0)
    ) RETURNING id INTO v_order_item_id;
  END LOOP;

  -- Create AI order record for tracking
  INSERT INTO public.ai_orders (
    telegram_chat_id, customer_name, customer_phone, customer_address,
    customer_city, customer_province, items, total_amount, 
    original_text, status, source, related_order_id, created_by
  ) VALUES (
    p_chat_id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_province, p_order_data->'items', 
    v_total_amount + v_delivery_fee, v_original_text, 'processed', 
    'telegram', v_order_id, v_employee_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_id', v_customer_id,
    'total_amount', v_total_amount + v_delivery_fee,
    'employee_id', v_employee_id,
    'message', 'تم إنشاء الطلب بنجاح'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE,
    'message', 'فشل في إنشاء الطلب: ' || SQLERRM
  );
END;
$function$;