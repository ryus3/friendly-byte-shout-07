-- إصلاح دالة معالجة طلبات التليجرام لاستخدام JOIN الصحيح مع profiles
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_items jsonb,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_address text DEFAULT NULL,
  p_telegram_chat_id bigint DEFAULT NULL,
  p_delivery_fee numeric DEFAULT 5000,
  p_original_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
  v_default_customer_name text;
  v_ai_order_id uuid;
  v_final_customer_name text;
  v_city_id integer;
  v_region_id integer;
  v_location_confidence numeric;
  v_location_suggestions jsonb;
  v_resolved_city_name text;
  v_resolved_region_name text;
  v_customer_city text;
  v_customer_province text;
BEGIN
  -- الحصول على معلومات الموظف من telegram_employee_codes مع JOIN الصحيح
  SELECT tec.user_id, p.full_name, p.default_customer_name
  INTO v_employee_id, v_employee_name, v_default_customer_name
  FROM telegram_employee_codes tec
  JOIN profiles p ON p.user_id = tec.user_id  -- ✅ إصلاح: استخدام p.user_id بدلاً من p.id
  WHERE tec.employee_code = p_employee_code
    AND tec.is_active = true;

  -- إذا لم يتم العثور على الموظف
  IF v_employee_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'employee_not_found',
      'message', 'رمز الموظف غير صحيح أو غير نشط: ' || p_employee_code
    );
  END IF;

  -- تحديد اسم العميل النهائي
  v_final_customer_name := COALESCE(
    NULLIF(TRIM(p_customer_name), ''),
    v_default_customer_name,
    'زبون تليغرام'
  );

  -- استخراج معلومات الموقع من العنوان
  IF p_customer_address IS NOT NULL AND p_customer_address != '' THEN
    SELECT 
      city_id, region_id, confidence, suggestions,
      resolved_city_name, resolved_region_name,
      customer_city, customer_province
    INTO 
      v_city_id, v_region_id, v_location_confidence, v_location_suggestions,
      v_resolved_city_name, v_resolved_region_name,
      v_customer_city, v_customer_province
    FROM extract_location_from_address(p_customer_address);
  END IF;

  -- إنشاء طلب AI
  INSERT INTO ai_orders (
    telegram_chat_id,
    items,
    total_amount,
    order_data,
    created_by,
    city_id,
    region_id,
    location_confidence,
    location_suggestions,
    delivery_fee,
    customer_name,
    customer_phone,
    customer_address,
    source,
    status,
    customer_city,
    customer_province,
    original_text,
    resolved_city_name,
    resolved_region_name
  ) VALUES (
    p_telegram_chat_id,
    p_items,
    (SELECT SUM((item->>'total_price')::numeric) FROM jsonb_array_elements(p_items) item) + COALESCE(p_delivery_fee, 5000),
    jsonb_build_object(
      'employee_code', p_employee_code,
      'employee_id', v_employee_id,
      'employee_name', v_employee_name,
      'customer_name', v_final_customer_name,
      'customer_phone', p_customer_phone,
      'customer_address', p_customer_address,
      'telegram_chat_id', p_telegram_chat_id,
      'delivery_fee', COALESCE(p_delivery_fee, 5000),
      'city_id', v_city_id,
      'region_id', v_region_id,
      'location_confidence', v_location_confidence,
      'location_suggestions', v_location_suggestions
    ),
    v_employee_id,
    v_city_id,
    v_region_id,
    COALESCE(v_location_confidence, 0),
    COALESCE(v_location_suggestions, '[]'::jsonb),
    COALESCE(p_delivery_fee, 5000),
    v_final_customer_name,
    p_customer_phone,
    p_customer_address,
    'telegram',
    'pending',
    v_customer_city,
    v_customer_province,
    p_original_text,
    v_resolved_city_name,
    v_resolved_region_name
  )
  RETURNING id INTO v_ai_order_id;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'employee_id', v_employee_id,
    'employee_name', v_employee_name,
    'customer_name', v_final_customer_name,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'location_confidence', v_location_confidence,
    'resolved_city_name', v_resolved_city_name,
    'resolved_region_name', v_resolved_region_name
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM,
      'detail', SQLSTATE
    );
END;
$function$;