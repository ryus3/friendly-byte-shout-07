-- حذف جميع نسخ الدالة المتضاربة
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint, uuid);
DROP FUNCTION IF EXISTS public.process_telegram_order(bigint, text, uuid);

-- إعادة إنشاء النسخة الصحيحة فقط (بالترتيب الصحيح: p_chat_id, p_message_text, p_employee_id)
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_chat_id BIGINT,
  p_message_text TEXT,
  p_employee_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone text;
  v_products jsonb;
  v_city_result record;
  v_address_lines text[];
  v_clean_address text;
  v_landmark text;
  v_employee_code text;
  v_order_data jsonb;
  v_total_amount numeric := 0;
  v_total_delivery_fee numeric := 5000;
  v_city_delivery_partner text := 'alwaseet';
  ai_order_id uuid;
  
  -- متغيرات معالجة العنوان الذكية
  v_address_line text;
  v_found_address_line boolean := false;
  v_city_name text;
  v_region_name text;
  v_address_words text[];
  v_word text;
  v_remaining_words text[] := ARRAY[]::text[];
  v_temp_landmark text;
  v_product_names text[];
  
  -- متغيرات استخراج اسم الزبون
  v_customer_name text;
  v_first_line text;
  v_default_name text;
  v_has_city boolean := false;
  v_has_phone boolean := false;
  v_has_product boolean := false;
BEGIN
  RAISE NOTICE '🚀 بدء معالجة طلب تليغرام من المحادثة: %', p_chat_id;
  RAISE NOTICE '📝 نص الرسالة: %', p_message_text;

  -- تنظيف النص وتحضيره
  v_clean_address := regexp_replace(
    regexp_replace(p_message_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_address_lines := string_to_array(trim(v_clean_address), ' ');

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_phone;

  -- استخراج المنتجات
  v_products := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_products;

  -- حساب المجموع الكلي للمنتجات
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_products) AS item;
  
  RAISE NOTICE '💰 مجموع المنتجات: %', v_total_amount;

  -- **بداية المعالجة الذكية للعنوان**
  RAISE NOTICE '🔍 بدء المعالجة الذكية للعنوان';
  
  -- تقسيم النص إلى أسطر منطقية بناءً على المسافات والنمط
  v_address_lines := string_to_array(p_message_text, E'\n');
  IF array_length(v_address_lines, 1) = 1 THEN
    -- إذا لم توجد أسطر منفصلة، قسم بناءً على النمط
    v_address_lines := string_to_array(p_message_text, ' ');
  END IF;

  -- **استخراج اسم الزبون من أول سطر**
  IF array_length(v_address_lines, 1) > 0 THEN
    v_first_line := trim(v_address_lines[1]);
    RAISE NOTICE '🔍 أول سطر: %', v_first_line;
    
    -- التحقق من أن السطر الأول ليس مدينة أو رقم أو منتج
    -- فحص إذا كان يحتوي على مدينة
    SELECT COUNT(*) > 0 INTO v_has_city
    FROM smart_search_city(v_first_line)
    WHERE confidence >= 0.7;
    
    -- فحص إذا كان يحتوي على رقم هاتف
    v_has_phone := v_first_line ~ '07[0-9]{9}' OR v_first_line ~ '9647[0-9]{9}';
    
    -- فحص إذا كان يحتوي على منتج
    SELECT COUNT(*) > 0 INTO v_has_product
    FROM products p
    WHERE p.is_active = true
      AND lower(v_first_line) LIKE '%' || lower(p.name) || '%';
    
    -- إذا كان السطر الأول لا يحتوي على مدينة أو رقم أو منتج، فهو الاسم
    IF NOT v_has_city AND NOT v_has_phone AND NOT v_has_product AND length(v_first_line) > 0 AND length(v_first_line) < 50 THEN
      v_customer_name := v_first_line;
      RAISE NOTICE '✅ تم استخراج اسم الزبون من أول سطر: %', v_customer_name;
    END IF;
  END IF;

  -- إذا لم يتم استخراج اسم من السطر الأول، استخدم الاسم الافتراضي
  IF v_customer_name IS NULL THEN
    -- الحصول على الاسم الافتراضي من إعدادات المستخدم
    IF p_employee_id IS NOT NULL THEN
      SELECT raw_user_meta_data->>'default_customer_name' INTO v_default_name
      FROM auth.users
      WHERE id = p_employee_id;
    ELSE
      -- محاولة الحصول عبر telegram_chat_id
      SELECT u.raw_user_meta_data->>'default_customer_name' INTO v_default_name
      FROM auth.users u
      JOIN employee_telegram_codes etc ON etc.user_id = u.id
      WHERE etc.telegram_chat_id = p_chat_id AND etc.is_active = true
      LIMIT 1;
    END IF;
    
    v_customer_name := COALESCE(NULLIF(trim(v_default_name), ''), 'زبون تليغرام');
    RAISE NOTICE '📝 استخدام الاسم الافتراضي: %', v_customer_name;
  END IF;

  -- البحث عن السطر الذي يحتوي على المدينة (سطر العنوان الحقيقي)
  FOR i IN 1..COALESCE(array_length(v_address_lines, 1), 0)
  LOOP
    v_address_line := trim(v_address_lines[i]);
    IF length(v_address_line) > 0 THEN
      -- محاولة البحث عن مدينة في هذا السطر
      SELECT city_id, city_name INTO v_city_result
      FROM smart_search_city(v_address_line)
      WHERE confidence >= 0.8
      ORDER BY confidence DESC
      LIMIT 1;
      
      IF v_city_result.city_id IS NOT NULL THEN
        v_found_address_line := true;
        RAISE NOTICE '✅ تم العثور على سطر العنوان: %', v_address_line;
        EXIT; -- توقف عند أول سطر يحتوي على مدينة
      END IF;
    END IF;
  END LOOP;

  -- إذا لم نجد سطر محدد، استخدم النص الكامل
  IF NOT v_found_address_line THEN
    v_address_line := p_message_text;
    RAISE NOTICE '⚠️ لم يتم العثور على سطر عنوان محدد، استخدام النص الكامل';
  END IF;

  -- البحث النهائي عن المدينة والمنطقة من السطر المحدد
  SELECT city_id, city_name INTO v_city_result
  FROM smart_search_city(v_address_line)
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_result.city_id IS NOT NULL THEN
    v_city_name := v_city_result.city_name;
    RAISE NOTICE '🏙️ المدينة المحددة: %', v_city_name;
    
    -- البحث عن المنطقة في نفس السطر
    SELECT region_name INTO v_region_name
    FROM smart_search_region(v_address_line, v_city_result.city_id)
    WHERE confidence >= 0.7
    ORDER BY confidence DESC
    LIMIT 1;
    
    RAISE NOTICE '🗺️ المنطقة المحددة: %', COALESCE(v_region_name, 'غير محدد');
  ELSE
    RAISE NOTICE '❌ لم يتم تحديد المدينة';
  END IF;

  -- **معالجة ذكية لاستخراج أقرب نقطة دالة من السطر المحدد فقط**
  IF v_found_address_line THEN
    -- تقسيم السطر إلى كلمات
    v_address_words := string_to_array(lower(trim(v_address_line)), ' ');
    
    -- الحصول على أسماء المنتجات للفلترة
    SELECT array_agg(lower(name)) INTO v_product_names
    FROM products WHERE is_active = true;
    
    -- معالجة كل كلمة في السطر
    FOREACH v_word IN ARRAY v_address_words
    LOOP
      v_word := trim(v_word);
      
      -- تجاهل الكلمات الفارغة والكلمات القصيرة جداً
      IF length(v_word) < 2 THEN CONTINUE; END IF;
      
      -- تجاهل أرقام الهاتف (أرقام طويلة)
      IF v_word ~ '^[0-9]{7,}$' THEN CONTINUE; END IF;
      
      -- تجاهل اسم المدينة والمنطقة
      IF lower(v_word) = lower(COALESCE(v_city_name, '')) 
         OR lower(v_word) = lower(COALESCE(v_region_name, '')) THEN 
        CONTINUE; 
      END IF;
      
      -- تجاهل أسماء المنتجات المعروفة
      IF v_product_names IS NOT NULL AND lower(v_word) = ANY(v_product_names) THEN
        CONTINUE;
      END IF;
      
      -- إضافة الكلمة المتبقية
      v_remaining_words := array_append(v_remaining_words, v_word);
    END LOOP;
    
    -- تجميع الكلمات المتبقية كأقرب نقطة دالة
    v_temp_landmark := array_to_string(v_remaining_words, ' ');
    
    -- تنظيف أقرب نقطة دالة
    v_landmark := COALESCE(NULLIF(trim(v_temp_landmark), ''), 'غير محدد');
    
    RAISE NOTICE '📍 أقرب نقطة دالة المستخرجة: %', v_landmark;
  ELSE
    v_landmark := 'غير محدد';
  END IF;

  -- الحصول على رمز الموظف
  IF p_employee_id IS NOT NULL THEN
    SELECT telegram_code INTO v_employee_code
    FROM employee_telegram_codes 
    WHERE user_id = p_employee_id AND is_active = true
    LIMIT 1;
  ELSE
    SELECT telegram_code INTO v_employee_code
    FROM employee_telegram_codes 
    WHERE telegram_chat_id = p_chat_id AND is_active = true
    LIMIT 1;
  END IF;

  -- بناء بيانات الطلب
  v_order_data := jsonb_build_object(
    'source', 'telegram',
    'chat_id', p_chat_id,
    'employee_code', COALESCE(v_employee_code, 'غير مُعين'),
    'extracted_data', jsonb_build_object(
      'phone', v_phone,
      'city', COALESCE(v_city_name, 'غير محدد'),
      'region', COALESCE(v_region_name, 'غير محدد'),
      'landmark', v_landmark,
      'products', v_products,
      'address_line_used', v_address_line,
      'customer_name', v_customer_name
    ),
    'total_amount', v_total_amount,
    'delivery_fee', v_total_delivery_fee,
    'delivery_partner', v_city_delivery_partner
  );

  -- إنشاء الطلب الذكي
  INSERT INTO ai_orders (
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    original_text,
    items,
    total_amount,
    order_data,
    source
  ) VALUES (
    p_chat_id,
    v_customer_name,
    v_phone,
    COALESCE(v_city_name, 'غير محدد'),
    v_landmark,
    p_message_text,
    v_products,
    v_total_amount + v_total_delivery_fee,
    v_order_data,
    'telegram'
  ) RETURNING id INTO ai_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب الذكي بنجاح: %', ai_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', ai_order_id,
    'message', 'تم إنشاء الطلب بنجاح',
    'extracted_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'phone', v_phone,
      'city', COALESCE(v_city_name, 'غير محدد'),
      'region', COALESCE(v_region_name, 'غير محدد'),
      'landmark', v_landmark,
      'products', v_products,
      'total_amount', v_total_amount + v_total_delivery_fee
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'حدث خطأ في معالجة الطلب'
    );
END;
$function$;