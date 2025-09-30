-- حذف الدالة القديمة وإنشاء دالة جديدة محسنة
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint);

CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_text text,
  p_chat_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lines text[];
  v_first_line text;
  v_customer_name text := 'زبون تليغرام';
  v_phone text;
  v_city_name text;
  v_region_name text := 'غير محدد';
  v_landmark text := 'غير محدد';
  v_address_line text;
  v_products jsonb;
  v_total_amount numeric := 0;
  v_city_match record;
  v_temp_landmark text;
  v_full_address text;
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🚀 بدء معالجة طلب تليغرام جديد';
  RAISE NOTICE '📝 النص الكامل: %', p_text;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(trim(p_text), E'\n');
  RAISE NOTICE '📋 عدد الأسطر: %', array_length(v_lines, 1);
  
  -- ===== استخراج اسم الزبون من السطر الأول =====
  v_first_line := trim(v_lines[1]);
  RAISE NOTICE '🔍 السطر الأول: "%"', v_first_line;
  
  -- التحقق من أن السطر الأول ليس عنواناً (لا يحتوي على اسم مدينة)
  SELECT c.name INTO v_city_match
  FROM cities_cache c
  WHERE c.is_active = true
    AND (
      lower(v_first_line) LIKE '%' || lower(c.name) || '%'
      OR lower(c.name) LIKE '%' || lower(v_first_line) || '%'
    )
  LIMIT 1;
  
  IF v_city_match.name IS NULL THEN
    -- السطر الأول لا يحتوي على اسم مدينة، إذن هو اسم الزبون
    IF length(v_first_line) >= 2 AND length(v_first_line) <= 50 THEN
      v_customer_name := v_first_line;
      RAISE NOTICE '✅ تم استخراج اسم الزبون: "%"', v_customer_name;
      -- استخدم السطر الثاني كعنوان
      IF array_length(v_lines, 1) >= 2 THEN
        v_address_line := trim(v_lines[2]);
      END IF;
    ELSE
      RAISE NOTICE '⚠️ السطر الأول طويل جداً، سيُعتبر عنواناً';
      v_address_line := v_first_line;
    END IF;
  ELSE
    RAISE NOTICE '⚠️ السطر الأول يحتوي على مدينة، سيُعتبر عنواناً';
    v_address_line := v_first_line;
  END IF;
  
  RAISE NOTICE '📬 سطر العنوان: "%"', v_address_line;
  
  -- ===== استخراج رقم الهاتف =====
  v_phone := extractphonefromtext(p_text);
  RAISE NOTICE '📞 رقم الهاتف: %', v_phone;
  
  -- ===== استخراج المدينة =====
  SELECT c.name INTO v_city_name
  FROM cities_cache c
  WHERE c.is_active = true
    AND (
      lower(v_address_line) LIKE '%' || lower(c.name) || '%'
      OR lower(c.name) LIKE '%' || lower(v_address_line) || '%'
    )
  ORDER BY 
    CASE 
      WHEN lower(c.name) = lower(v_address_line) THEN 1
      WHEN lower(v_address_line) LIKE lower(c.name) || '%' THEN 2
      WHEN lower(v_address_line) LIKE '%' || lower(c.name) || '%' THEN 3
      ELSE 4
    END,
    length(c.name) DESC
  LIMIT 1;
  
  v_city_name := COALESCE(v_city_name, 'بغداد');
  RAISE NOTICE '🏙️ المدينة المستخرجة: %', v_city_name;
  
  -- ===== استخراج المنطقة =====
  SELECT r.name INTO v_region_name
  FROM regions_cache r
  JOIN cities_cache c ON r.alwaseet_city_id = c.alwaseet_id
  WHERE c.name = v_city_name
    AND r.is_active = true
    AND (
      lower(v_address_line) LIKE '%' || lower(r.name) || '%'
      OR lower(r.name) LIKE '%' || lower(v_address_line) || '%'
    )
  ORDER BY 
    CASE 
      WHEN lower(r.name) = lower(v_address_line) THEN 1
      WHEN lower(v_address_line) LIKE lower(r.name) || '%' THEN 2
      WHEN lower(v_address_line) LIKE '%' || lower(r.name) || '%' THEN 3
      ELSE 4
    END,
    length(r.name) DESC
  LIMIT 1;
  
  v_region_name := COALESCE(v_region_name, 'مركز');
  RAISE NOTICE '🗺️ المنطقة المستخرجة: %', v_region_name;
  
  -- ===== استخراج نقطة الدلالة (landmark) =====
  v_temp_landmark := v_address_line;
  
  -- إزالة المدينة
  v_temp_landmark := REPLACE(v_temp_landmark, v_city_name, '');
  
  -- إزالة المنطقة
  IF v_region_name IS NOT NULL AND v_region_name != 'غير محدد' AND v_region_name != 'مركز' THEN
    v_temp_landmark := REPLACE(v_temp_landmark, v_region_name, '');
  END IF;
  
  -- إزالة أرقام الهاتف
  v_temp_landmark := regexp_replace(v_temp_landmark, '(00)?9647[0-9]{9}|07[0-9]{9}', '', 'g');
  
  -- تنظيف المسافات الزائدة والفواصل
  v_temp_landmark := regexp_replace(v_temp_landmark, '\s+', ' ', 'g');
  v_temp_landmark := regexp_replace(v_temp_landmark, '^[\s،\-]+|[\s،\-]+$', '', 'g');
  v_temp_landmark := TRIM(v_temp_landmark);
  
  -- حفظ النتيجة
  IF v_temp_landmark != '' AND LENGTH(v_temp_landmark) >= 3 THEN
    v_landmark := v_temp_landmark;
  ELSE
    v_landmark := 'غير محدد';
  END IF;
  
  RAISE NOTICE '📍 نقطة الدلالة المستخرجة: %', v_landmark;
  
  -- ===== بناء العنوان الكامل =====
  v_full_address := v_city_name || ' - ' || v_region_name;
  IF v_landmark != 'غير محدد' AND v_landmark != '' THEN
    v_full_address := v_full_address || ' - ' || v_landmark;
  END IF;
  
  RAISE NOTICE '📬 العنوان الكامل: %', v_full_address;
  
  -- ===== استخراج المنتجات =====
  v_products := extract_product_items_from_text(p_text);
  RAISE NOTICE '🛒 المنتجات المستخرجة: %', v_products;
  
  -- حساب المجموع
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_products) item;
  
  RAISE NOTICE '💰 المبلغ الإجمالي: %', v_total_amount;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ انتهت المعالجة بنجاح';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  -- إرجاع البيانات المستخرجة
  RETURN jsonb_build_object(
    'success', true,
    'customer_name', v_customer_name,
    'customer_phone', v_phone,
    'customer_city', v_city_name,
    'customer_province', v_region_name,
    'customer_address', v_region_name || CASE WHEN v_landmark != 'غير محدد' THEN ' - ' || v_landmark ELSE '' END,
    'items', v_products,
    'total_amount', v_total_amount,
    'telegram_chat_id', p_chat_id,
    'original_text', p_text,
    'order_data', jsonb_build_object(
      'source', 'telegram',
      'chat_id', p_chat_id,
      'original_text', p_text,
      'extracted_data', jsonb_build_object(
        'customer_name', v_customer_name,
        'phone', v_phone,
        'city', v_city_name,
        'region', v_region_name,
        'landmark', v_landmark,
        'full_address', v_full_address,
        'products', v_products,
        'total_amount', v_total_amount
      )
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في المعالجة: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'customer_name', 'خطأ',
      'customer_phone', 'غير محدد',
      'customer_city', 'غير محدد',
      'customer_province', 'غير محدد',
      'customer_address', 'غير محدد',
      'items', '[]'::jsonb,
      'total_amount', 0
    );
END;
$function$;