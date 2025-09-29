-- حذف الدالة القديمة وإنشاء النسخة المصححة
DROP FUNCTION IF EXISTS public.process_telegram_order(text, bigint);

-- إنشاء دالة process_telegram_order مصححة
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  input_text text,
  chat_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_items jsonb;
  v_customer_name text := '';
  v_customer_phone text := '';
  v_customer_city text := '';
  v_customer_province text := '';
  v_customer_address text := '';
  v_city_id integer;
  v_region_id integer;
  v_words text[];
  v_word text;
  v_delivery_fee numeric := 0;
  v_total_amount numeric := 0;
  v_normalized_text text;
  v_phone_match text;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تلغرام: %', input_text;
  
  -- تطبيع النص وتقسيمه إلى كلمات
  v_normalized_text := regexp_replace(
    regexp_replace(input_text, E'[\r\n]+', ' ', 'g'),
    E'\\s+', ' ', 'g'
  );
  v_words := string_to_array(lower(trim(v_normalized_text)), ' ');
  
  -- استخراج رقم الهاتف العراقي بطريقة محسنة
  -- البحث عن أرقام تبدأ بـ 07 مع 8 أرقام إضافية
  v_phone_match := (SELECT (regexp_matches(input_text, '(?:^|[^0-9])(07[0-9]{8})(?:[^0-9]|$)'))[1]);
  
  IF v_phone_match IS NOT NULL THEN
    v_customer_phone := '+964' || substring(v_phone_match from 2);
    RAISE NOTICE '📱 تم العثور على رقم الهاتف: %', v_customer_phone;
  ELSE
    -- البحث البديل في الكلمات
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF v_word ~ '^07[0-9]{8}$' THEN
        v_customer_phone := '+964' || substring(v_word from 2);
        RAISE NOTICE '📱 تم العثور على رقم الهاتف من الكلمات: %', v_customer_phone;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  -- استخراج المنتجات (الحفاظ على الوظيفة الموجودة)
  SELECT extract_product_items_from_text(input_text) INTO v_items;
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items;
  
  -- حساب المبلغ الإجمالي من المنتجات
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0) 
  INTO v_total_amount
  FROM jsonb_array_elements(v_items) AS item;
  
  -- جلب رسوم التوصيل من الإعدادات
  SELECT COALESCE(delivery_fee, 5000) INTO v_delivery_fee
  FROM public.settings
  LIMIT 1;
  
  -- إضافة رسوم التوصيل للمبلغ الإجمالي
  v_total_amount := v_total_amount + v_delivery_fee;
  
  RAISE NOTICE '💰 المبلغ الإجمالي مع رسوم التوصيل: % (رسوم التوصيل: %)', v_total_amount, v_delivery_fee;
  
  -- استخراج المدينة بطريقة بسيطة وآمنة
  FOREACH v_word IN ARRAY v_words
  LOOP
    -- البحث عن المدن في cache
    SELECT cc.id, cc.name INTO v_city_id, v_customer_city
    FROM cities_cache cc
    WHERE cc.is_active = true
      AND (lower(cc.name) = v_word OR lower(cc.name) LIKE '%' || v_word || '%')
    ORDER BY 
      CASE WHEN lower(cc.name) = v_word THEN 1 ELSE 2 END,
      cc.name
    LIMIT 1;
    
    IF v_city_id IS NOT NULL THEN
      RAISE NOTICE '🏙️ تم العثور على المدينة: %', v_customer_city;
      EXIT;
    END IF;
  END LOOP;
  
  -- إذا لم يتم العثور على مدينة، استخدم أول كلمة
  IF v_customer_city = '' AND array_length(v_words, 1) > 0 THEN
    v_customer_city := v_words[1];
    RAISE NOTICE '🏙️ استخدام المدينة الافتراضية: %', v_customer_city;
  END IF;
  
  -- العنوان الكامل
  v_customer_address := input_text;
  v_customer_name := 'عميل تلغرام';
  
  -- إرجاع النتيجة المطلوبة
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم معالجة الطلب بنجاح',
    'customer_name', v_customer_name,
    'customer_phone', COALESCE(v_customer_phone, ''),
    'customer_city', COALESCE(v_customer_city, ''),
    'customer_province', COALESCE(v_customer_province, ''),
    'customer_address', COALESCE(v_customer_address, ''),
    'city_id', v_city_id,
    'region_id', v_region_id,
    'items', v_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'original_text', input_text,
    'telegram_chat_id', chat_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'customer_phone', '',
      'total_amount', 0,
      'delivery_fee', 0,
      'items', '[]'::jsonb
    );
END;
$function$;