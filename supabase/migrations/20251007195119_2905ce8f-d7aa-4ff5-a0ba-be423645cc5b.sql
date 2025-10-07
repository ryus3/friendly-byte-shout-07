-- تعديل دالة process_telegram_order الموجودة لإضافة استخراج الملاحظات
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_employee_code text,
  p_message_text text,
  p_telegram_chat_id bigint,
  p_created_by text DEFAULT NULL::text,
  p_fallback_city text DEFAULT NULL::text,
  p_fallback_region text DEFAULT NULL::text,
  p_fallback_confidence numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id uuid;
  v_phone text;
  v_customer_name text := 'زبون تليغرام';
  v_address text;
  v_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_city_id integer;
  v_region_id integer;
  v_resolved_city_name text;
  v_resolved_region_name text;
  v_location_confidence numeric := 0;
  v_notes text := NULL;
  v_line text;
  v_lines_for_notes text[];
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام من الموظف: %', p_employee_code;
  
  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_phone;
  
  -- إذا لم يتم العثور على رقم هاتف صحيح، نرجع خطأ
  IF v_phone = 'غير محدد' OR v_phone IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'phone_not_found',
      'message', 'لم يتم العثور على رقم هاتف صحيح في الرسالة'
    );
  END IF;
  
  -- استخراج اسم الزبون (أي سطر يحتوي على كلمات عربية فقط ولا يحتوي على أرقام)
  WITH lines AS (
    SELECT unnest(string_to_array(p_message_text, E'\n')) AS line
  ),
  name_candidates AS (
    SELECT 
      TRIM(line) AS potential_name,
      length(TRIM(line)) AS name_length
    FROM lines
    WHERE TRIM(line) != ''
      AND TRIM(line) !~ '[0-9]'
      AND TRIM(line) !~* '(قرب|محلة|حي|شارع|زقاق|عمارة|بناية|منطقة|مدينة)'
      AND length(TRIM(line)) BETWEEN 3 AND 50
      AND TRIM(line) ~ '[ء-ي]'
  )
  SELECT potential_name INTO v_customer_name
  FROM name_candidates
  ORDER BY name_length DESC
  LIMIT 1;
  
  -- استخدام الاسم الافتراضي إذا لم يتم العثور على اسم
  v_customer_name := COALESCE(NULLIF(v_customer_name, ''), 'زبون تليغرام');
  RAISE NOTICE '👤 اسم الزبون المستخرج: %', v_customer_name;
  
  -- استخراج العنوان الفعلي
  v_address := extract_actual_address(p_message_text);
  RAISE NOTICE '🏠 العنوان المستخرج: %', v_address;
  
  -- استخراج الملاحظات من أي سطر يحتوي على "ملاحظة" أو "ملاحظه"
  v_lines_for_notes := string_to_array(p_message_text, E'\n');
  FOREACH v_line IN ARRAY v_lines_for_notes
  LOOP
    IF v_line ~* 'ملاحظ[ةه]' THEN
      v_notes := TRIM(v_line);
      RAISE NOTICE '📝 الملاحظات المستخرجة: %', v_notes;
      EXIT;
    END IF;
  END LOOP;
  
  -- استخدام fallback إذا كانت متوفرة
  IF p_fallback_city IS NOT NULL AND p_fallback_region IS NOT NULL THEN
    v_resolved_city_name := p_fallback_city;
    v_resolved_region_name := p_fallback_region;
    v_location_confidence := COALESCE(p_fallback_confidence, 0);
    
    -- محاولة الحصول على city_id و region_id
    SELECT c.id INTO v_city_id
    FROM cities_cache c
    WHERE LOWER(c.name) = LOWER(p_fallback_city)
    LIMIT 1;
    
    SELECT r.id INTO v_region_id
    FROM regions_cache r
    WHERE LOWER(r.name) = LOWER(p_fallback_region)
      AND (v_city_id IS NULL OR r.city_id = v_city_id)
    LIMIT 1;
    
    RAISE NOTICE '🎯 استخدام fallback - المدينة: %, المنطقة: %, الثقة: %', v_resolved_city_name, v_resolved_region_name, v_location_confidence;
  END IF;
  
  -- استخراج المنتجات
  v_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items;
  
  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item
  WHERE (item->>'is_available')::boolean = true;
  
  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;
  
  -- إنشاء سجل الطلب
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    original_text,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    items,
    total_amount,
    delivery_fee,
    order_data,
    status,
    source,
    created_by,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    location_confidence,
    notes
  ) VALUES (
    p_telegram_chat_id,
    p_message_text,
    v_customer_name,
    v_phone,
    v_address,
    v_resolved_city_name,
    NULL,
    v_items,
    v_total_amount,
    v_delivery_fee,
    jsonb_build_object(
      'raw_message', p_message_text,
      'processed_at', now(),
      'employee_code', p_employee_code
    ),
    'pending',
    'telegram',
    p_created_by,
    v_city_id,
    v_region_id,
    v_resolved_city_name,
    v_resolved_region_name,
    v_location_confidence,
    v_notes
  )
  RETURNING id INTO v_order_id;
  
  RAISE NOTICE '✅ تم إنشاء طلب AI بنجاح - المعرف: %', v_order_id;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_phone,
    'customer_address', v_address,
    'customer_city', v_resolved_city_name,
    'customer_region', v_resolved_region_name,
    'location_confidence', v_location_confidence,
    'items', v_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'notes', v_notes
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة طلب تليغرام: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$function$;