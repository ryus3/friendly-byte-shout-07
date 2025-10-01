-- حذف الدالة القديمة بالتوقيع القديم
DROP FUNCTION IF EXISTS public.process_telegram_order(p_chat_id bigint, p_message_text text, p_employee_code text);

-- التأكد من أن الدالة الجديدة ترجع customer_name في extracted_data
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text text,
  p_telegram_chat_id bigint,
  p_telegram_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_default_customer_name text := 'زبون تليغرام';
  v_first_line text := NULL;
  v_extracted_name text := NULL;
  v_city_check integer := 0;
  v_line_offset integer := 0;
  v_customer_name text := NULL;
  v_region_name text := NULL;
  v_phone text;
  v_product_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_customer_id uuid;
  v_customer_city text := NULL;
  v_customer_address text := NULL;
  v_order_id uuid;
  v_total_amount numeric := 0;
  v_delivery_fee numeric := 5000;
  v_final_amount numeric := 0;
  v_alternatives_message text := '';
  v_has_unavailable boolean := false;
  v_city_found boolean := false;
  v_city_id integer;
  v_region_id integer;
  v_matched_city record;
  v_customer_province text := NULL;
BEGIN
  RAISE NOTICE '🔄 بدء معالجة طلب تليغرام من المستخدم: %', p_telegram_username;

  -- الحصول على user_id من telegram_chat_id
  SELECT user_id INTO v_user_id
  FROM public.employee_telegram_codes
  WHERE telegram_chat_id = p_telegram_chat_id
    AND is_active = true
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على user_id للمستخدم: %', p_telegram_username;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', '❌ لم يتم العثور على حسابك. يرجى التواصل مع الإدارة.'
    );
  END IF;

  -- الحصول على الاسم الافتراضي من الملف الشخصي
  SELECT display_name INTO v_default_customer_name
  FROM public.profiles
  WHERE id = v_user_id;

  v_default_customer_name := COALESCE(v_default_customer_name, 'زبون تليغرام');

  RAISE NOTICE '👤 الاسم الافتراضي من الملف الشخصي: %', v_default_customer_name;

  -- ============ منطق استخراج الاسم الذكي ============
  -- استخراج السطر الأول
  v_first_line := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1)), '');

  IF v_first_line IS NULL OR v_first_line = '' THEN
    v_extracted_name := NULL;
    v_line_offset := 0;
  -- فحص: هل هو رقم هاتف؟
  ELSIF v_first_line ~ '07[0-9]{9}' THEN
    v_extracted_name := NULL;
    v_line_offset := 0;
    RAISE NOTICE '📱 السطر الأول رقم هاتف، ليس اسم: %', v_first_line;
  ELSE
    -- فحص: هل هو مدينة معروفة؟
    SELECT COUNT(*) INTO v_city_check 
    FROM smart_search_city(v_first_line)
    WHERE confidence >= 0.7;
    
    IF v_city_check > 0 THEN
      -- هذا عنوان/مدينة، ليس اسم
      v_extracted_name := NULL;
      v_line_offset := 0;
      RAISE NOTICE '🏙️ السطر الأول مدينة معروفة، ليس اسم: %', v_first_line;
    ELSIF LENGTH(v_first_line) BETWEEN 2 AND 50 THEN
      -- ✅ هذا اسم صالح!
      v_extracted_name := v_first_line;
      v_line_offset := 1; -- نبدأ العنوان من السطر الثاني
      RAISE NOTICE '👤 تم استخراج الاسم من النص: %', v_extracted_name;
    ELSE
      v_extracted_name := NULL;
      v_line_offset := 0;
      RAISE NOTICE '⚠️ السطر الأول غير صالح كاسم (طول غير مناسب): %', v_first_line;
    END IF;
  END IF;

  -- تحديد الاسم النهائي
  v_customer_name := COALESCE(
    NULLIF(TRIM(v_extracted_name), ''),
    NULLIF(TRIM(v_default_customer_name), ''),
    'زبون تليغرام'
  );

  RAISE NOTICE '✅ الاسم المستخدم: % (من: %)', 
    v_customer_name, 
    CASE WHEN v_extracted_name IS NOT NULL THEN 'النص' ELSE 'الافتراضي' END;

  -- استخراج المنطقة من السطر المناسب
  v_region_name := NULLIF(TRIM(SPLIT_PART(p_message_text, E'\n', 1 + v_line_offset)), '');
  IF v_region_name IS NULL OR v_region_name = '' THEN
    v_region_name := 'غير محدد';
  END IF;

  RAISE NOTICE '📍 المنطقة المستخرجة: %', v_region_name;

  -- استخراج رقم الهاتف
  v_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_phone;

  -- استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '📦 المنتجات المستخرجة: %', v_product_items;

  -- التحقق من وجود منتجات غير متوفرة
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    IF (v_item->>'is_available')::boolean = false THEN
      v_has_unavailable := true;
      v_alternatives_message := COALESCE(v_item->>'alternatives_message', '');
      EXIT;
    END IF;
    v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
  END LOOP;

  -- إذا كانت هناك منتجات غير متوفرة، أرجع رسالة البدائل
  IF v_has_unavailable THEN
    RAISE NOTICE '⚠️ توجد منتجات غير متوفرة';
    RETURN jsonb_build_object(
      'success', false,
      'error', 'product_unavailable',
      'message', v_alternatives_message,
      'extracted_data', jsonb_build_object(
        'customer_name', v_customer_name,
        'phone', v_phone,
        'region', v_region_name
      )
    );
  END IF;

  -- البحث عن المدينة
  SELECT city_id, city_name INTO v_city_id, v_customer_city
  FROM smart_search_city(v_region_name)
  WHERE confidence >= 0.7
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_id IS NOT NULL THEN
    v_city_found := true;
    v_customer_province := v_customer_city;
    RAISE NOTICE '🎯 تم العثور على المدينة: % (ID: %)', v_customer_city, v_city_id;
  ELSE
    v_customer_city := 'غير محدد';
    v_customer_province := 'غير محدد';
    RAISE NOTICE '⚠️ لم يتم العثور على المدينة';
  END IF;

  -- حساب المبلغ النهائي
  v_final_amount := v_total_amount + v_delivery_fee;

  -- البحث عن العنوان الكامل
  v_customer_address := extract_actual_address(p_message_text);
  RAISE NOTICE '🏠 العنوان المستخرج: %', v_customer_address;

  -- البحث عن أو إنشاء العميل
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE phone = v_phone
    AND created_by = v_user_id
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (name, phone, city, province, address, created_by)
    VALUES (v_customer_name, v_phone, v_customer_city, v_customer_province, v_customer_address, v_user_id)
    RETURNING id INTO v_customer_id;
    RAISE NOTICE '✅ تم إنشاء عميل جديد: %', v_customer_id;
  ELSE
    UPDATE public.customers
    SET name = v_customer_name,
        city = v_customer_city,
        province = v_customer_province,
        address = v_customer_address,
        updated_at = now()
    WHERE id = v_customer_id;
    RAISE NOTICE '✅ تم تحديث العميل الموجود: %', v_customer_id;
  END IF;

  -- إنشاء الطلب
  INSERT INTO public.orders (
    customer_id,
    customer_name,
    customer_phone,
    customer_city,
    customer_province,
    customer_address,
    total_amount,
    delivery_fee,
    final_amount,
    status,
    created_by,
    source
  ) VALUES (
    v_customer_id,
    v_customer_name,
    v_phone,
    v_customer_city,
    v_customer_province,
    v_customer_address,
    v_total_amount,
    v_delivery_fee,
    v_final_amount,
    'pending',
    v_user_id,
    'telegram'
  )
  RETURNING id INTO v_order_id;

  RAISE NOTICE '✅ تم إنشاء الطلب: %', v_order_id;

  -- إضافة عناصر الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      quantity,
      unit_price,
      total_price
    )
    SELECT
      v_order_id,
      pv.product_id,
      pv.id,
      (v_item->>'quantity')::integer,
      COALESCE((v_item->>'price')::numeric, 0),
      COALESCE((v_item->>'total_price')::numeric, 0)
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes s ON pv.size_id = s.id
    WHERE LOWER(p.name) LIKE '%' || LOWER(v_item->>'product_name') || '%'
      AND LOWER(c.name) = LOWER(v_item->>'color')
      AND LOWER(s.name) = LOWER(v_item->>'size')
    LIMIT 1;
  END LOOP;

  RAISE NOTICE '✅ تمت معالجة الطلب بنجاح';

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'total_amount', v_final_amount,
    'items', v_product_items,
    'extracted_data', jsonb_build_object(
      'customer_name', v_customer_name,
      'phone', v_phone,
      'city', v_customer_city,
      'region', v_region_name,
      'items', v_product_items,
      'total_amount', v_total_amount,
      'delivery_fee', v_delivery_fee,
      'final_amount', v_final_amount
    ),
    'message', '✅ تم إنشاء الطلب بنجاح!' || E'\n' ||
               '👤 الزبون: ' || v_customer_name || E'\n' ||
               '📱 الهاتف: ' || v_phone || E'\n' ||
               '📍 المدينة: ' || v_customer_city || E'\n' ||
               '💰 المبلغ الإجمالي: ' || v_final_amount || ' دينار'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_error',
      'message', '❌ حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى أو التواصل مع الإدارة.',
      'details', SQLERRM
    );
END;
$function$;