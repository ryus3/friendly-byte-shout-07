-- Fix the closest point function issue by ensuring clean addresses are saved and used
-- Update process_telegram_order to return clean address data that can be used directly

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_result jsonb;
  v_extracted_address text;
  v_customer_city text;
  v_customer_province text;
  v_customer_phone text;
  v_customer_name text;
  v_items jsonb;
  v_total_amount numeric;
  v_city_id integer;
  v_region_id integer;
BEGIN
  -- Call the existing order processing function to extract products and location data
  SELECT process_order_from_text(p_message_text) INTO v_order_result;
  
  -- Extract basic order data
  v_customer_city := v_order_result->>'customer_city';
  v_customer_province := COALESCE(v_order_result->>'customer_province', v_customer_city);
  v_customer_phone := v_order_result->>'customer_phone';
  v_customer_name := COALESCE(v_order_result->>'customer_name', 'عميل');
  v_items := COALESCE(v_order_result->'items', '[]'::jsonb);
  v_total_amount := COALESCE((v_order_result->>'total_amount')::numeric, 0);
  v_city_id := COALESCE((v_order_result->>'city_id')::integer, NULL);
  v_region_id := COALESCE((v_order_result->>'region_id')::integer, NULL);
  
  -- Extract the clean address (closest point) from the original text
  v_extracted_address := extract_actual_address(p_message_text, v_customer_city);
  
  -- Return the order result with the clean extracted address
  RETURN jsonb_build_object(
    'success', COALESCE(v_order_result->>'success', 'true')::boolean,
    'order_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'customer_phone', v_customer_phone,
      'customer_city', v_customer_city,
      'customer_province', v_customer_province,
      'customer_address', COALESCE(v_extracted_address, ''), -- Use the clean extracted address
      'city_id', v_city_id,
      'region_id', v_region_id,
      'items', v_items,
      'total_amount', v_total_amount,
      'original_text', p_message_text,
      'created_by', '91484496-b887-44f7-9e5d-be9db5567604'::uuid -- Default admin user
    ),
    'message', COALESCE(v_order_result->>'message', 'تم معالجة الطلب بنجاح'),
    'options_type', v_order_result->>'options_type',
    'suggested_cities', v_order_result->>'suggested_cities',
    'available_combinations', v_order_result->>'available_combinations'
  );
END;
$function$;