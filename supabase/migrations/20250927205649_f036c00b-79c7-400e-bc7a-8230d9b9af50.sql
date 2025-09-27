-- إضافة مرادفات شاملة للمناطق الشائعة
INSERT INTO public.region_aliases (region_id, alias_name, normalized_name, confidence_score) VALUES
-- مرادفات الشامية
(6, 'الشاميه', 'الشاميه', 1.0),
(6, 'شاميه', 'شاميه', 1.0),
(6, 'شامية', 'شامية', 1.0),
(6, 'الشامية', 'الشامية', 1.0),
(6, 'شامیه', 'شامیه', 0.9),
(6, 'شامیة', 'شامیة', 0.9),

-- مرادفات الصحة
(7, 'الصحه', 'الصحه', 1.0),
(7, 'صحه', 'صحه', 1.0),
(7, 'صحة', 'صحة', 1.0),
(7, 'الصحة', 'الصحة', 1.0),
(7, 'دورة صحة', 'دورة صحة', 1.0),
(7, 'دوره صحه', 'دوره صحه', 0.9),

-- مرادفات الجامعة
(8, 'الجامعه', 'الجامعه', 1.0),
(8, 'جامعه', 'جامعه', 1.0),
(8, 'جامعة', 'جامعة', 1.0),
(8, 'الجامعة', 'الجامعة', 1.0),
(8, 'جامعه بغداد', 'جامعه بغداد', 1.0),
(8, 'جامعة بغداد', 'جامعة بغداد', 1.0),

-- مرادفات الكرادة
(9, 'الكراده', 'الكراده', 1.0),
(9, 'كراده', 'كراده', 1.0),
(9, 'كرادة', 'كرادة', 1.0),
(9, 'الكرادة', 'الكرادة', 1.0),
(9, 'کراده', 'کراده', 0.9),
(9, 'کرادة', 'کرادة', 0.9),

-- مرادفات المنصور
(10, 'المنصور', 'المنصور', 1.0),
(10, 'منصور', 'منصور', 1.0),
(10, 'المنصوریه', 'المنصوریه', 0.9),
(10, 'منصوریه', 'منصوریه', 0.9),

-- مرادفات الجادرية
(11, 'الجادريه', 'الجادريه', 1.0),
(11, 'جادريه', 'جادريه', 1.0),
(11, 'جادرية', 'جادرية', 1.0),
(11, 'الجادرية', 'الجادرية', 1.0),
(11, 'جادریه', 'جادریه', 0.9),
(11, 'جادریة', 'جادریة', 0.9),

-- مرادفات الأعظمية
(12, 'الاعظميه', 'الاعظميه', 1.0),
(12, 'اعظميه', 'اعظميه', 1.0),
(12, 'اعظمية', 'اعظمية', 1.0),
(12, 'الاعظمية', 'الاعظمية', 1.0),
(12, 'الأعظمية', 'الأعظمية', 1.0),
(12, 'أعظمية', 'أعظمية', 1.0),

-- مرادفات الكاظمية
(13, 'الكاظميه', 'الكاظميه', 1.0),
(13, 'كاظميه', 'كاظميه', 1.0),
(13, 'كاظمية', 'كاظمية', 1.0),
(13, 'الكاظمية', 'الكاظمية', 1.0),
(13, 'کاظميه', 'کاظميه', 0.9),
(13, 'کاظمية', 'کاظمية', 0.9),

-- مرادفات المدينة والثورة
(14, 'مدينه الثوره', 'مدينه الثوره', 1.0),
(14, 'مدينة الثورة', 'مدينة الثورة', 1.0),
(14, 'الثوره', 'الثوره', 1.0),
(14, 'الثورة', 'الثورة', 1.0),
(14, 'ثوره', 'ثوره', 0.9),
(14, 'ثورة', 'ثورة', 0.9),

-- مرادفات الشعلة
(15, 'الشعله', 'الشعله', 1.0),
(15, 'شعله', 'شعله', 1.0),
(15, 'شعلة', 'شعلة', 1.0),
(15, 'الشعلة', 'الشعلة', 1.0),
(15, 'شعله حي', 'شعله حي', 1.0),
(15, 'شعلة حي', 'شعلة حي', 1.0);

-- تحديث وظيفة معالجة طلبات تليغرام لتتضمن البحث الذكي في المناطق
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer_id uuid;
  v_total_amount numeric := 26000; -- مبلغ افتراضي
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
  v_smart_city_result record;
  v_smart_region_result record;
  v_found_region_id integer;
  v_found_region_name text;
  v_confirmed_address text := '';
  v_success_message text := '';
  v_product_name text := '';
  v_product_color text := '';
  v_product_size text := '';
  v_quantity integer := 1;
  v_words text[];
  v_word text;
  v_text_lower text;
BEGIN
  -- استخراج معلومات العميل
  v_customer_name := p_order_data->>'customer_name';
  v_customer_phone := p_order_data->>'customer_phone';
  v_customer_address := p_order_data->>'customer_address';
  v_customer_city := p_order_data->>'customer_city';
  v_customer_province := p_order_data->>'customer_province';
  v_original_text := p_order_data->>'original_text';

  -- الحصول على معرف الموظف
  SELECT user_id INTO v_employee_id
  FROM public.employee_telegram_codes 
  WHERE telegram_chat_id = p_chat_id AND is_active = true
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    v_employee_id := COALESCE(p_employee_id, v_default_manager_id);
  END IF;

  -- استخراج تفاصيل المنتج من النص الأصلي
  IF v_original_text IS NOT NULL AND trim(v_original_text) != '' THEN
    v_text_lower := lower(trim(v_original_text));
    
    -- استخراج اسم المنتج
    IF v_text_lower ~ 'ارجنتين|ارجنتین' THEN
      v_product_name := 'ارجنتين';
    ELSIF v_text_lower ~ 'قميص|قمیص' THEN
      v_product_name := 'قميص';
    ELSIF v_text_lower ~ 'بنطال|بنطلون' THEN
      v_product_name := 'بنطال';
    ELSIF v_text_lower ~ 'جاكيت|جاکيت' THEN
      v_product_name := 'جاكيت';
    ELSE
      v_product_name := 'منتج';
    END IF;
    
    -- استخراج اللون
    IF v_text_lower ~ 'سمائي|سماوي|ازرق فاتح' THEN
      v_product_color := 'سمائي';
    ELSIF v_text_lower ~ 'احمر|أحمر' THEN
      v_product_color := 'أحمر';
    ELSIF v_text_lower ~ 'ازرق|أزرق' THEN
      v_product_color := 'أزرق';
    ELSIF v_text_lower ~ 'اسود|أسود' THEN
      v_product_color := 'أسود';
    ELSIF v_text_lower ~ 'ابيض|أبيض' THEN
      v_product_color := 'أبيض';
    ELSIF v_text_lower ~ 'اخضر|أخضر' THEN
      v_product_color := 'أخضر';
    END IF;
    
    -- استخراج الحجم
    IF v_text_lower ~ '\m(m|ميديم|متوسط)' THEN
      v_product_size := 'M';
    ELSIF v_text_lower ~ '\m(l|لارج|كبير)' THEN
      v_product_size := 'L';
    ELSIF v_text_lower ~ '\m(xl|اكس لارج|كبير جدا)' THEN
      v_product_size := 'XL';
    ELSIF v_text_lower ~ '\m(s|سمول|صغير)' THEN
      v_product_size := 'S';
    END IF;
    
    -- تقسيم النص إلى كلمات للبحث عن المدينة والمنطقة
    v_words := string_to_array(replace(replace(v_original_text, '،', ' '), ',', ' '), ' ');
    
    -- البحث عن المدينة والمنطقة
    FOREACH v_word IN ARRAY v_words
    LOOP
      IF length(trim(v_word)) >= 3 THEN
        -- البحث في المدن أولاً
        SELECT * INTO v_smart_city_result 
        FROM smart_search_city(trim(v_word)) 
        WHERE confidence >= 0.7
        LIMIT 1;
        
        IF v_smart_city_result.city_id IS NOT NULL THEN
          v_found_city_id := v_smart_city_result.city_id;
          v_found_city_name := v_smart_city_result.city_name;
        END IF;
        
        -- البحث في المناطق (بغداد افتراضياً إذا لم تُعثر على مدينة)
        SELECT * INTO v_smart_region_result 
        FROM smart_search_region(trim(v_word)) 
        WHERE confidence >= 0.7
        LIMIT 1;
        
        IF v_smart_region_result.region_id IS NOT NULL THEN
          v_found_region_id := v_smart_region_result.region_id;
          v_found_region_name := v_smart_region_result.region_name;
          
          -- إذا وُجدت منطقة ولم توجد مدينة، استخدم بغداد كافتراضي
          IF v_found_city_id IS NULL THEN
            SELECT id, name INTO v_found_city_id, v_found_city_name
            FROM cities_cache 
            WHERE lower(name) = 'بغداد' 
            LIMIT 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- إذا لم تُعثر على مدينة، استخدم بغداد كافتراضي
  IF v_found_city_id IS NULL THEN
    SELECT id, name INTO v_found_city_id, v_found_city_name
    FROM cities_cache 
    WHERE lower(name) = 'بغداد' 
    LIMIT 1;
  END IF;

  -- تعيين اسم المدينة المؤكد
  v_customer_city := v_found_city_name;

  -- التعامل مع العميل
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    SELECT id INTO v_customer_id
    FROM public.customers
    WHERE phone = v_customer_phone
    LIMIT 1;
    
    IF v_customer_id IS NOT NULL THEN
      UPDATE public.customers 
      SET 
        name = v_customer_name,
        address = v_customer_address,
        city = v_customer_city,
        province = v_customer_province,
        updated_at = now()
      WHERE id = v_customer_id;
    ELSE
      INSERT INTO public.customers (
        name, phone, address, city, province, created_by
      ) VALUES (
        v_customer_name, v_customer_phone, v_customer_address, 
        v_customer_city, v_customer_province, v_employee_id
      ) RETURNING id INTO v_customer_id;
    END IF;
  ELSE
    INSERT INTO public.customers (
      name, phone, address, city, province, created_by
    ) VALUES (
      v_customer_name, v_customer_phone, v_customer_address, 
      v_customer_city, v_customer_province, v_employee_id
    ) RETURNING id INTO v_customer_id;
  END IF;

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
    p_order_data->'items', v_total_amount, v_original_text, 
    'pending', 'telegram', v_employee_id, p_order_data
  ) RETURNING id INTO v_ai_order_id;

  -- إنشاء رسالة النجاح بالتنسيق المطلوب
  v_success_message := '✅ تم استلام الطلب!' || E'\n';
  v_success_message := v_success_message || '📍 ' || v_confirmed_address;
  
  IF v_customer_phone IS NOT NULL AND trim(v_customer_phone) != '' THEN
    v_success_message := v_success_message || E'\n📱 الهاتف: ' || v_customer_phone;
  END IF;
  
  -- إضافة تفاصيل المنتج
  v_success_message := v_success_message || E'\n✅ ' || v_product_name;
  IF v_product_color IS NOT NULL AND v_product_color != '' THEN
    v_success_message := v_success_message || ' (' || v_product_color || ')';
  END IF;
  IF v_product_size IS NOT NULL AND v_product_size != '' THEN
    v_success_message := v_success_message || ' ' || v_product_size;
  END IF;
  v_success_message := v_success_message || ' × ' || v_quantity;
  
  -- إضافة المبلغ الإجمالي
  v_success_message := v_success_message || E'\n• المبلغ الاجمالي: ' || to_char(v_total_amount, 'FM999,999') || ' د.ع';

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