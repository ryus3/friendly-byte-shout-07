-- حذف جميع دوال process_telegram_order القديمة والمكررة
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, numeric, jsonb, bigint, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, numeric, jsonb, bigint, text, text, text);
DROP FUNCTION IF EXISTS public.process_telegram_order(jsonb, text, text, text, text, text, numeric, jsonb, bigint, text, text, text, text);

-- إنشاء الدالة الصحيحة الوحيدة بثلاثة معاملات فقط
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb,
  p_employee_code text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_ai_order_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_city text;
  v_customer_province text;
  v_customer_address text;
  v_total_amount numeric;
  v_items jsonb;
BEGIN
  -- البحث عن المستخدم باستخدام employee_code
  SELECT tec.user_id INTO v_user_id
  FROM public.telegram_employee_codes tec
  WHERE tec.employee_code = p_employee_code
    AND tec.telegram_chat_id = p_chat_id
    AND tec.is_active = true;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'الموظف غير موجود أو غير مربوط'
    );
  END IF;

  -- استخراج البيانات من order_data
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := COALESCE(p_order_data->>'customer_province', v_customer_city);
  v_customer_address := COALESCE(p_order_data->>'customer_address', '');
  v_total_amount := COALESCE((p_order_data->>'final_total')::numeric, (p_order_data->>'total_price')::numeric, 0);
  v_items := COALESCE(p_order_data->'items', '[]'::jsonb);

  -- إنشاء AI order مع ربطه بالمستخدم الصحيح
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    total_amount,
    items,
    order_data,
    telegram_chat_id,
    created_by,
    source,
    status,
    original_text
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_province,
    v_customer_address,
    v_total_amount,
    v_items,
    p_order_data,
    p_chat_id,
    v_user_id, -- هنا الأهمية: ربط الطلب بالمستخدم الصحيح
    'telegram',
    'pending',
    COALESCE(p_order_data->>'original_text', 'طلب من التليغرام')
  ) RETURNING id INTO v_ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_ai_order_id,
    'user_id', v_user_id,
    'message', 'تم إنشاء الطلب بنجاح'
  );
END;
$function$;

-- تحديث الطلبات الموجودة التي لديها created_by = null
UPDATE public.ai_orders 
SET created_by = (
  SELECT tec.user_id 
  FROM public.telegram_employee_codes tec 
  WHERE tec.telegram_chat_id = ai_orders.telegram_chat_id 
    AND tec.is_active = true 
  LIMIT 1
),
updated_at = now()
WHERE created_by IS NULL 
  AND telegram_chat_id IS NOT NULL
  AND source = 'telegram';