-- Fix the process_telegram_order function to correctly query delivery_fee from settings
CREATE OR REPLACE FUNCTION public.process_telegram_order(input_text text, chat_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_items jsonb;
  v_phone text;
  v_city_result jsonb;
  v_delivery_fee numeric := 5000;
  v_total_amount numeric := 0;
  v_customer_name text := '';
  v_customer_address text := '';
  v_customer_city text := '';
  v_customer_province text := '';
  v_region_id integer;
  v_city_id integer;
  v_order_id uuid;
  v_item jsonb;
  item_total numeric;
  v_success boolean := false;
  v_error_message text := '';
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام للمحادثة %: %', chat_id, input_text;

  -- تنظيف النص المدخل
  input_text := trim(regexp_replace(input_text, E'[\\r\\n]+', ' ', 'g'));
  
  -- الحصول على رسوم التوصيل من الإعدادات
  BEGIN
    SELECT COALESCE((value)::numeric, 5000) INTO v_delivery_fee 
    FROM public.settings 
    WHERE key = 'delivery_fee' 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_delivery_fee := 5000;
    RAISE NOTICE '⚠️ لم يتم العثور على رسوم التوصيل، استخدام القيمة الافتراضية: %', v_delivery_fee;
  END;
  
  RAISE NOTICE '💰 رسوم التوصيل: %', v_delivery_fee;

  -- استخراج رقم الهاتف العراقي
  v_phone := public.extract_iraqi_phone(input_text);
  RAISE NOTICE '📞 رقم الهاتف المستخرج: %', v_phone;

  -- استخراج اسم العميل والعنوان (السطر الأول = العنوان)
  DECLARE
    lines text[];
  BEGIN
    lines := string_to_array(input_text, E'\n');
    IF array_length(lines, 1) >= 1 THEN
      v_customer_address := trim(lines[1]);
    END IF;
    -- يمكن استخراج الاسم من السطر الثاني أو من سياق آخر حسب الحاجة
    v_customer_name := 'عميل تليغرام';
  END;

  -- البحث عن المدينة في النص
  SELECT public.smart_search_city(input_text) INTO v_city_result;
  
  IF v_city_result IS NOT NULL AND jsonb_array_length(v_city_result) > 0 THEN
    SELECT 
      (v_city_result->0->>'city_id')::integer,
      v_city_result->0->>'city_name'
    INTO v_city_id, v_customer_city;
    
    RAISE NOTICE '🏙️ تم العثور على المدينة: % (ID: %)', v_customer_city, v_city_id;
  END IF;

  -- استخراج المنتجات من النص
  v_items := public.extract_product_items_from_text(input_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_items;

  -- التحقق من صحة المنتجات وحساب المجموع
  v_total_amount := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    item_total := COALESCE((v_item->>'total_price')::numeric, 0);
    v_total_amount := v_total_amount + item_total;
    
    -- التحقق من توفر المنتج
    IF COALESCE((v_item->>'is_available')::boolean, false) = false THEN
      v_success := false;
      v_error_message := COALESCE(v_item->>'alternatives_message', 'منتج غير متوفر');
      RAISE NOTICE '❌ منتج غير متوفر: %', v_item->>'product_name';
      
      RETURN jsonb_build_object(
        'success', false,
        'error', v_error_message,
        'items', v_items,
        'total_amount', v_total_amount,
        'delivery_fee', v_delivery_fee,
        'customer_phone', COALESCE(v_phone, '')
      );
    END IF;
  END LOOP;

  -- إذا كانت جميع المنتجات متوفرة، إنشاء الطلب
  IF jsonb_array_length(v_items) > 0 AND v_total_amount > 0 THEN
    INSERT INTO public.ai_orders (
      customer_phone,
      customer_name,
      customer_address,
      customer_city,
      customer_province,
      city_id,
      region_id,
      telegram_chat_id,
      items,
      total_amount,
      original_text,
      source,
      status,
      order_data
    ) VALUES (
      COALESCE(v_phone, ''),
      v_customer_name,
      v_customer_address,
      COALESCE(v_customer_city, ''),
      v_customer_province,
      v_city_id,
      v_region_id,
      chat_id,
      v_items,
      v_total_amount,
      input_text,
      'telegram',
      'pending',
      jsonb_build_object(
        'delivery_fee', v_delivery_fee,
        'total_with_delivery', v_total_amount + v_delivery_fee,
        'extracted_phone', v_phone,
        'extracted_city', v_customer_city
      )
    ) RETURNING id INTO v_order_id;

    v_success := true;
    RAISE NOTICE '✅ تم إنشاء الطلب بنجاح: %', v_order_id;
  ELSE
    v_success := false;
    v_error_message := 'لم يتم العثور على منتجات صالحة في الطلب';
  END IF;

  RETURN jsonb_build_object(
    'success', v_success,
    'error', COALESCE(v_error_message, ''),
    'items', v_items,
    'total_amount', v_total_amount,
    'delivery_fee', v_delivery_fee,
    'customer_phone', COALESCE(v_phone, ''),
    'order_id', v_order_id,
    'customer_city', COALESCE(v_customer_city, ''),
    'customer_address', COALESCE(v_customer_address, '')
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'items', COALESCE(v_items, '[]'::jsonb),
      'total_amount', 0,
      'delivery_fee', v_delivery_fee,
      'customer_phone', COALESCE(v_phone, '')
    );
END;
$function$;