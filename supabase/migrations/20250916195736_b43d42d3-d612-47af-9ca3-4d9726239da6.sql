-- تحديث دالة process_telegram_order لدعم معرفات المدن والمناطق من cache
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
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_user_id uuid;
  v_delivery_partner text := 'alwaseet'; -- جميع طلبات التليغرام للوسيط
  v_item jsonb;
  v_final_amount numeric := COALESCE(p_total_amount, 0);
BEGIN
  -- الحصول على معرف المستخدم من employee_code
  SELECT user_id INTO v_user_id 
  FROM public.telegram_employee_codes 
  WHERE employee_code = p_employee_code 
    AND telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;
  
  -- إذا لم نجد المستخدم، حاول البحث بطريقة أخرى
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id 
    FROM public.profiles 
    WHERE employee_code = p_employee_code
    LIMIT 1;
  END IF;
  
  -- إنشاء AI order مع البيانات المحسنة
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
    source,
    status
  ) VALUES (
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    COALESCE(p_customer_city, 'بغداد'), -- القيمة الافتراضية
    p_customer_region,
    p_city_id,
    p_region_id,
    v_final_amount,
    p_items,
    p_order_data,
    p_telegram_chat_id,
    COALESCE(v_user_id::text, p_employee_code),
    'telegram',
    'pending'
  ) RETURNING id INTO v_order_id;
  
  RAISE NOTICE 'تم إنشاء طلب تليغرام ذكي: % للموظف: % مع معرفات المدينة: % والمنطقة: %', 
    v_order_id, p_employee_code, p_city_id, p_region_id;
  
  RETURN v_order_id;
END;
$function$;