-- حذف الدالة القديمة وإنشاؤها من جديد
DROP FUNCTION IF EXISTS public.process_telegram_order;

-- إنشاء دالة معالجة طلبات التليغرام الجديدة
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL,
  p_customer_address text DEFAULT NULL,
  p_customer_city text DEFAULT NULL,
  p_customer_region text DEFAULT NULL,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_total_amount numeric DEFAULT 0,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_telegram_chat_id bigint DEFAULT NULL,
  p_employee_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ai_order_id uuid;
  v_employee_id uuid;
BEGIN
  -- البحث عن الموظف من خلال employee_code
  IF p_employee_code IS NOT NULL THEN
    SELECT user_id INTO v_employee_id
    FROM public.telegram_employee_codes
    WHERE employee_code = p_employee_code
      AND is_active = true
      AND telegram_chat_id = p_telegram_chat_id;
  END IF;

  -- إنشاء سجل في ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    city_id,
    region_id,
    total_amount,
    items,
    order_data,
    telegram_chat_id,
    created_by,
    status,
    source,
    original_text
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    p_customer_city,
    p_customer_region,
    p_city_id,
    p_region_id,
    p_total_amount,
    p_items,
    p_order_data,
    p_telegram_chat_id,
    v_employee_id,
    'pending',
    'telegram',
    p_order_data->>'original_text'
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_id', v_employee_id,
    'message', 'تم حفظ الطلب بنجاح في ai_orders'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'فشل في حفظ الطلب'
    );
END;
$$;