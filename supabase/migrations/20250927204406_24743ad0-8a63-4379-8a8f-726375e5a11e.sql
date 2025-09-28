-- تحسين دالة process_telegram_order لتتعامل مع المرادفات الجديدة وتعطي رسائل مؤكدة
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_id uuid;
  v_total_amount numeric := 0;
  v_item jsonb;
  v_delivery_fee numeric := 0;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_city text;
  v_customer_province text;
  v_original_text text;
  v_employee_id uuid;
  v_default_manager_id uuid := '91484496-b887-44f7-9e5d-be9db5567604'::uuid;
  v_ai_order_id uuid;
  v_found_city_id integer;
  v_found_city_name text;
  v_city_suggestions text := '';
  v_smart_city_result record;
  v_smart_region_result record;
  v_found_region_id integer;
  v_found_region_name text;
  v_confirmed_address text := '';
  v_success_message text := '';
BEGIN
  -- Extract customer info from order data
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_original_text := p_order_data->>'original_text';

  -- Get employee ID from telegram chat
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id AND is_active = true
  LIMIT 1;

  -- Use provided employee_id as fallback
  IF v_employee_id IS NULL THEN
    v_employee_id := p_employee_id;
  END IF;

  -- Use default manager if still no employee found
  IF v_employee_id IS NULL THEN
    v_employee_id := v_default_manager_id;
    RAISE NOTICE 'لم يتم العثور على موظف مرتبط بـ chat_id: %, استخدام المدير الافتراضي', p_chat_id;
  END IF;

  -- محاولة استخراج المدينة من النص الأصلي باستخدام البحث الذكي
  IF v_original_text IS NOT NULL AND trim(v_original_text) != '' THEN
    -- تجربة كلمات مختلفة من النص للعثور على المدينة
    DECLARE
      v_words text[];
      v_word text;
      v_found boolean := false;
    BEGIN
      -- تقسيم النص إلى كلمات
      v_words := string_to_array(replace(replace(v_original_text, '،', ' '), ',', ' '), ' ');
      
      -- البحث في كل كلمة
      FOREACH v_word IN ARRAY v_words
      LOOP
        IF length(trim(v_word)) >= 3 THEN -- تجاهل الكلمات القصيرة جداً
          SELECT * INTO v_smart_city_result 
          FROM smart_search_city(trim(v_word)) 
          WHERE confidence >= 0.8 -- ثقة عالية فقط
          LIMIT 1;
          
          IF v_smart_city_result.city_id IS NOT NULL THEN
            v_found_city_id := v_smart_city_result.city_id;
            v_found_city_name := v_smart_city_result.city_name;
            v_found := true;
            RAISE NOTICE 'تم العثور على المدينة: % من الكلمة: %', v_found_city_name, v_word;
            EXIT; -- توقف عند أول مطابقة
          END IF;
        END IF;
      END LOOP;
      
      -- إذا لم نجد مدينة بثقة عالية، جرب بثقة أقل
      IF NOT v_found THEN
        FOREACH v_word IN ARRAY v_words
        LOOP
          IF length(trim(v_word)) >= 3 THEN
            SELECT * INTO v_smart_city_result 
            FROM smart_search_city(trim(v_word)) 
            WHERE confidence >= 0.6 -- ثقة متوسطة
            LIMIT 1;
            
            IF v_smart_city_result.city_id IS NOT NULL THEN
              v_found_city_id := v_smart_city_result.city_id;
              v_found_city_name := v_smart_city_result.city_name;
              v_found := true;
              RAISE NOTICE 'تم العثور على المدينة بثقة متوسطة: % من الكلمة: %', v_found_city_name, v_word;
              EXIT;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END;
  END IF;

  -- إذا لم نجد مدينة، اطلب التوضيح
  IF v_found_city_id IS NULL THEN
    -- جمع اقتراحات ذكية للمدن الشائعة
    SELECT string_agg(name, E'\n• ') INTO v_city_suggestions
    FROM (
      SELECT name FROM cities_cache 
      WHERE is_active = true 
      ORDER BY id 
      LIMIT 8
    ) common_cities;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', 'city_not_found',
      'message', '🏙️ يرجى تحديد المدينة في طلبك' ||
                 E'\n\n💡 المدن المتوفرة:' ||
                 E'\n• ' || COALESCE(v_city_suggestions, 'غير متوفر') ||
                 E'\n\n📝 مثال: "قميص أحمر للديوانية"',
      'suggested_cities', v_city_suggestions,
      'options_type', 'city_selection'
    );
  END IF;

  -- تعيين اسم المدينة المؤكد
  v_customer_city := v_found_city_name;

  -- Handle customer creation/update properly
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    -- Try to find existing customer by phone
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = v_customer_phone
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      -- Update existing customer
      UPDATE public.customers 
      SET 
        name = v_customer_name,
        address = v_customer_address,
        city = v_customer_city,
        province = v_customer_province,
        updated_at = now()
      WHERE id = v_customer_id;
    ELSE
      -- Create new customer with phone
      INSERT INTO public.customers (
        name, phone, address, city, province, created_by
      ) VALUES (
        v_customer_name, v_customer_phone, v_customer_address, 
        v_customer_city, v_customer_province, v_employee_id
      ) RETURNING id INTO v_customer_id;
    END IF;
  ELSE
    -- Create new customer without phone
    INSERT INTO public.customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      v_customer_name, v_customer_phone, v_customer_address, 
      v_customer_city, v_customer_province, v_employee_id
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- Set delivery fee based on address
  v_delivery_fee := CASE 
    WHEN v_customer_address IS NOT NULL AND trim(v_customer_address) != '' THEN 2500
    ELSE 0
  END;

  -- تكوين العنوان المؤكد
  v_confirmed_address := v_found_city_name;
  IF v_found_region_name IS NOT NULL THEN
    v_confirmed_address := v_confirmed_address || ' - ' || v_found_region_name;
  END IF;

  -- إنشاء سجل الطلب الذكي
  INSERT INTO public.ai_orders (
    telegram_chat_id, customer_name, customer_phone, customer_address,
    customer_city, customer_province, city_id, region_id, items, total_amount, 
    original_text, status, source, created_by, order_data
  ) VALUES (
    p_chat_id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_province, v_found_city_id, v_found_region_id, 
    p_order_data->'items', v_total_amount + v_delivery_fee, v_original_text, 
    'pending', 'telegram', v_employee_id, p_order_data
  ) RETURNING id INTO v_ai_order_id;

  -- إنشاء رسالة النجاح الذكية
  v_success_message := '✅ تم استلام طلبك بنجاح!' || E'\n\n';
  v_success_message := v_success_message || '👤 العميل: ' || v_customer_name || E'\n';
  
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    v_success_message := v_success_message || '📱 الهاتف: ' || v_customer_phone || E'\n';
  END IF;
  
  v_success_message := v_success_message || '📍 العنوان المؤكد: ' || v_confirmed_address || E'\n';
  v_success_message := v_success_message || '📝 النص الأصلي: ' || v_original_text || E'\n';
  v_success_message := v_success_message || E'\n⏰ سيتم التواصل معك قريباً لتأكيد التفاصيل والتوصيل.';

  RETURN jsonb_build_object(
    'success', true,
    'message', v_success_message,
    'confirmed_address', v_confirmed_address,
    'city_name', v_found_city_name,
    'region_name', v_found_region_name,
    'ai_order_id', v_ai_order_id,
    'customer_id', v_customer_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'خطأ في معالجة طلب تليغرام: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'processing_error',
    'message', '⚠️ حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.',
    'details', SQLERRM
  );
END;
$function$;