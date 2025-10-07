-- تعديل الدالة الموجودة process_telegram_order لإضافة منطق الملاحظات
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_telegram_chat_id bigint,
  p_created_by text DEFAULT NULL::text,
  p_source text DEFAULT 'telegram'::text,
  p_customer_name text DEFAULT 'زبون تليغرام'::text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_address text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_actual_address text;
  v_product_items jsonb;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_order_data jsonb;
  v_ai_order_id uuid;
  v_city_id integer;
  v_region_id integer;
  v_resolved_city_name text;
  v_resolved_region_name text;
  v_location_confidence numeric := 0;
  v_location_suggestions jsonb := '[]'::jsonb;
  v_notes text := NULL;
  v_line text;
  v_lines_for_notes text[];
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام من الدالة المحدثة';
  
  -- استخراج اسم الزبون
  v_customer_name := COALESCE(
    NULLIF(TRIM(p_customer_name), ''),
    extractnamefromtext(p_message_text),
    'زبون تليغرام'
  );
  
  -- استخراج رقم الهاتف
  v_customer_phone := COALESCE(
    NULLIF(TRIM(p_customer_phone), ''),
    extractphonefromtext(p_message_text),
    'غير محدد'
  );
  
  -- استخراج العنوان الفعلي
  v_actual_address := COALESCE(
    NULLIF(TRIM(p_customer_address), ''),
    extract_actual_address(p_message_text),
    'لم يُحدد'
  );
  
  v_customer_address := v_actual_address;
  
  RAISE NOTICE '📋 معلومات الزبون - الاسم: %, الهاتف: %, العنوان: %', 
    v_customer_name, v_customer_phone, v_customer_address;
  
  -- استخراج المنتجات من النص
  v_product_items := extract_product_items_from_text(p_message_text);
  
  IF v_product_items IS NULL OR jsonb_array_length(v_product_items) = 0 THEN
    RAISE NOTICE '⚠️ لم يتم العثور على منتجات';
    v_product_items := '[]'::jsonb;
  END IF;
  
  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0) INTO v_total_amount
  FROM jsonb_array_elements(v_product_items) AS item
  WHERE (item->>'is_available')::boolean = true;
  
  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;
  
  -- البحث عن المدينة والمنطقة
  SELECT 
    city_id, region_id, city_name, region_name, confidence, suggestions
  INTO 
    v_city_id, v_region_id, v_resolved_city_name, v_resolved_region_name, 
    v_location_confidence, v_location_suggestions
  FROM find_city_and_region_smart(v_customer_address);
  
  RAISE NOTICE '🌍 الموقع - المدينة: % (ID: %), المنطقة: % (ID: %), الثقة: %',
    v_resolved_city_name, v_city_id, v_resolved_region_name, v_region_id, v_location_confidence;
  
  -- استخراج الملاحظات من النص
  v_lines_for_notes := string_to_array(p_message_text, E'\n');
  FOREACH v_line IN ARRAY v_lines_for_notes
  LOOP
    IF v_line ~* 'ملاحظ[ةه]' THEN
      v_notes := TRIM(v_line);
      EXIT;
    END IF;
  END LOOP;
  
  RAISE NOTICE '📝 الملاحظات المستخرجة: %', COALESCE(v_notes, 'لا توجد ملاحظات');
  
  -- بناء بيانات الطلب
  v_order_data := jsonb_build_object(
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'original_text', p_message_text,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'resolved_city_name', v_resolved_city_name,
    'resolved_region_name', v_resolved_region_name,
    'location_confidence', v_location_confidence,
    'location_suggestions', v_location_suggestions,
    'notes', v_notes
  );
  
  -- إدخال الطلب في جدول ai_orders
  INSERT INTO public.ai_orders (
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    items,
    total_amount,
    delivery_fee,
    order_data,
    original_text,
    telegram_chat_id,
    created_by,
    source,
    city_id,
    region_id,
    resolved_city_name,
    resolved_region_name,
    location_confidence,
    location_suggestions,
    notes,
    status
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_address,
    v_resolved_city_name,
    NULL,
    v_product_items,
    v_total_amount,
    v_delivery_fee,
    v_order_data,
    p_message_text,
    p_telegram_chat_id,
    p_created_by,
    p_source,
    v_city_id,
    v_region_id,
    v_resolved_city_name,
    v_resolved_region_name,
    v_location_confidence,
    v_location_suggestions,
    v_notes,
    'pending'
  ) RETURNING id INTO v_ai_order_id;
  
  RAISE NOTICE '✅ تم إنشاء الطلب الذكي بنجاح - ID: %', v_ai_order_id;
  
  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_address', v_customer_address,
    'items', v_product_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'city_id', v_city_id,
    'region_id', v_region_id,
    'resolved_city_name', v_resolved_city_name,
    'resolved_region_name', v_resolved_region_name,
    'location_confidence', v_location_confidence,
    'location_suggestions', v_location_suggestions,
    'notes', v_notes,
    'message', 'تم معالجة الطلب بنجاح'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'فشل في معالجة الطلب'
    );
END;
$function$;