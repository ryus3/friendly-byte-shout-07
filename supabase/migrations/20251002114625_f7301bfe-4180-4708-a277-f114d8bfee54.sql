-- تحديث process_telegram_order لحفظ resolved_city_name و resolved_region_name
CREATE OR REPLACE FUNCTION public.process_telegram_order(p_order_data jsonb, p_chat_id bigint, p_employee_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_product_name text;
  v_color_name text;
  v_size_name text;
  v_quantity integer;
  v_available_quantity integer;
  v_variant_exists boolean;
  v_product_id uuid;
  v_error_message text := '';
  v_available_combinations text := '';
  v_color_info text;
  
  -- متغيرات البحث الذكي للمدن والمناطق
  v_found_city_id integer;
  v_found_city_name text;
  v_city_suggestions text := '';
  v_region_suggestions text := '';
  v_smart_city_result record;
  v_smart_region_result record;
  v_found_region_id integer;
  v_found_region_name text;
  v_address_details text := '';
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

  -- Validate required fields
  IF v_customer_name IS NULL OR trim(v_customer_name) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'missing_customer_name',
      'message', 'اسم العميل مطلوب'
    );
  END IF;

  -- التحقق الذكي من المدينة (إذا كانت موجودة)
  IF v_customer_city IS NOT NULL AND trim(v_customer_city) != '' THEN
    -- البحث الذكي عن المدينة
    SELECT * INTO v_smart_city_result 
    FROM smart_search_city(v_customer_city) 
    LIMIT 1;
    
    IF v_smart_city_result.city_id IS NOT NULL THEN
      v_found_city_id := v_smart_city_result.city_id;
      v_found_city_name := v_smart_city_result.city_name;
      
      -- تحديث اسم المدينة بالاسم الصحيح المعترف به
      v_customer_city := v_found_city_name;
      
      -- البحث الذكي عن المنطقة (إذا كانت موجودة في العنوان)
      IF v_customer_address IS NOT NULL AND trim(v_customer_address) != '' THEN
        -- استخراج أول جزء من العنوان كمنطقة محتملة
        DECLARE
          v_potential_region text := TRIM(SPLIT_PART(v_customer_address, ',', 1));
        BEGIN
          IF v_potential_region != '' THEN
            SELECT * INTO v_smart_region_result
            FROM smart_search_region(v_potential_region, v_found_city_id)
            LIMIT 1;
            
            IF v_smart_region_result.region_id IS NOT NULL THEN
              v_found_region_id := v_smart_region_result.region_id;
              v_found_region_name := v_smart_region_result.region_name;
            END IF;
          END IF;
        END;
      END IF;
      
    ELSE
      -- لم يتم العثور على المدينة، جمع اقتراحات ذكية
      SELECT string_agg(city_name || ' (ثقة: ' || ROUND(confidence * 100) || '%)', E'\n• ') INTO v_city_suggestions
      FROM (
        SELECT city_name, confidence
        FROM smart_search_city(v_customer_city)
        WHERE match_type LIKE '%partial%'
        ORDER BY confidence DESC
        LIMIT 5
      ) suggestions;
      
      -- إذا لم نجد حتى اقتراحات تقريبية، نعرض بعض المدن الشائعة
      IF v_city_suggestions IS NULL OR v_city_suggestions = '' THEN
        SELECT string_agg(name, E'\n• ') INTO v_city_suggestions
        FROM (
          SELECT name FROM cities_cache 
          WHERE is_active = true 
          ORDER BY id 
          LIMIT 8
        ) common_cities;
      END IF;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'city_not_found',
        'message', '🏙️ لم نتمكن من العثور على المدينة "' || v_customer_city || '".' ||
                   E'\n\n💡 هل تقصد إحدى هذه المدن؟' ||
                   E'\n• ' || COALESCE(v_city_suggestions, 'غير متوفر') ||
                   E'\n\n📝 يرجى الرد برقم الخيار الصحيح أو كتابة اسم المدينة بوضوح.',
        'input_city', v_customer_city,
        'suggested_cities', v_city_suggestions,
        'options_type', 'city_selection'
      );
    END IF;
  END IF;

  -- التحقق من توفر جميع المنتجات المطلوبة قبل إنشاء الطلب
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    v_product_name := v_item->>'product_name';
    v_color_name := v_item->>'color';
    v_size_name := v_item->>'size';
    v_quantity := COALESCE((v_item->>'quantity')::integer, 1);
    
    -- البحث عن المنتج
    SELECT p.id INTO v_product_id
    FROM products p
    WHERE LOWER(TRIM(p.name)) = LOWER(TRIM(v_product_name))
    LIMIT 1;
    
    IF v_product_id IS NULL THEN
      -- جمع المنتجات المشابهة المتوفرة
      SELECT string_agg(DISTINCT p.name, E'\n• ') INTO v_error_message
      FROM products p
      WHERE p.name ILIKE '%' || split_part(v_product_name, ' ', 1) || '%'
      LIMIT 10;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'product_not_found',
        'message', '🛍️ المنتج "' || v_product_name || '" غير موجود.' ||
                   CASE WHEN v_error_message IS NOT NULL 
                        THEN E'\n\n💡 المنتجات المتوفرة:' || E'\n• ' || v_error_message
                        ELSE ''
                   END,
        'product_name', v_product_name
      );
    END IF;
    
    -- فحص توفر المنتج بالمواصفات المطلوبة
    SELECT 
      CASE WHEN COUNT(*) > 0 THEN true ELSE false END,
      COALESCE(SUM(GREATEST(0, COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))), 0)
    INTO v_variant_exists, v_available_quantity
    FROM product_variants pv
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes s ON pv.size_id = s.id
    LEFT JOIN inventory i ON pv.id = i.variant_id
    WHERE pv.product_id = v_product_id
      AND LOWER(TRIM(c.name)) = LOWER(TRIM(v_color_name))
      AND LOWER(TRIM(s.name)) = LOWER(TRIM(v_size_name))
      AND GREATEST(0, COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0)) > 0;
    
    IF NOT v_variant_exists OR v_available_quantity = 0 THEN
      -- إنشاء قائمة بالألوان والأحجام المتوفرة فعلياً مع ترقيم
      v_available_combinations := '';
      
      SELECT string_agg(
        ROW_NUMBER() OVER (ORDER BY c.name) || '. ' || c.name || ' (' || 
        string_agg(DISTINCT s.name, '، ' ORDER BY s.name) || ')',
        E'\n'
      ) INTO v_available_combinations
      FROM product_variants pv
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes s ON pv.size_id = s.id
      LEFT JOIN inventory i ON pv.id = i.variant_id
      WHERE pv.product_id = v_product_id
        AND GREATEST(0, COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0)) > 0
      GROUP BY c.id, c.name
      HAVING COUNT(*) > 0;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'variant_not_available',
        'message', '🛍️ المنتج "' || v_product_name || '" غير متوفر باللون "' || v_color_name || '" والحجم "' || v_size_name || '".' ||
                   E'\n\n🎨 الخيارات المتوفرة:' ||
                   E'\n' || COALESCE(v_available_combinations, 'لا يوجد مخزون متوفر') ||
                   E'\n\n📝 يرجى الرد برقم الخيار المطلوب.',
        'product_name', v_product_name,
        'requested_color', v_color_name,
        'requested_size', v_size_name,
        'available_combinations', v_available_combinations,
        'options_type', 'variant_selection'
      );
    END IF;
    
    -- فحص الكمية المتوفرة
    IF v_available_quantity < v_quantity THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'insufficient_stock',
        'message', '📦 المنتج "' || v_product_name || '" باللون "' || v_color_name || '" والحجم "' || v_size_name || 
                   '" متوفر بكمية ' || v_available_quantity || ' فقط، والمطلوب ' || v_quantity ||
                   E'\n\n🔄 يمكنك تعديل الكمية أو اختيار منتجات أخرى.',
        'product_name', v_product_name,
        'color', v_color_name,
        'size', v_size_name,
        'available_quantity', v_available_quantity,
        'requested_quantity', v_quantity
      );
    END IF;
    
    -- حساب المبلغ الإجمالي
    v_total_amount := v_total_amount + COALESCE((v_item->>'quantity')::numeric, 1) * COALESCE((v_item->>'unit_price')::numeric, 0);
  END LOOP;

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

  -- إنشاء سجل الطلب الذكي مع حفظ resolved_city_name و resolved_region_name
  INSERT INTO public.ai_orders (
    telegram_chat_id, customer_name, customer_phone, customer_address,
    customer_city, customer_province, city_id, region_id, 
    resolved_city_name, resolved_region_name,
    items, total_amount, 
    original_text, status, source, created_by, order_data
  ) VALUES (
    p_chat_id, v_customer_name, v_customer_phone, v_customer_address,
    v_customer_city, v_customer_province, v_found_city_id, v_found_region_id,
    v_found_city_name, v_found_region_name,
    p_order_data->'items', v_total_amount + v_delivery_fee, 
    v_original_text, 
    'pending', 'telegram', v_employee_id, p_order_data
  ) RETURNING id INTO v_ai_order_id;

  -- إنشاء رسالة النجاح الذكية
  v_success_message := '✅ تم استلام الطلب!' || E'\n\n';
  
  -- إضافة معلومات العميل
  v_success_message := v_success_message || '📱 الهاتف: ' || COALESCE(v_customer_phone, 'غير محدد') || E'\n';
  
  -- إضافة المنتجات
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_data->'items')
  LOOP
    v_success_message := v_success_message || '✅ ' || (v_item->>'product_name') || 
                        ' (' || (v_item->>'color') || ') ' || (v_item->>'size') || 
                        ' × ' || COALESCE((v_item->>'quantity')::text, '1') || E'\n';
  END LOOP;
  
  -- إضافة المبلغ الإجمالي
  v_success_message := v_success_message || '• المبلغ الاجمالي: ' || 
                        to_char(v_total_amount + v_delivery_fee, 'FM999,999,999') || ' د.ع' || E'\n\n';

  -- إضافة العنوان الصحيح المختار
  IF v_found_city_name IS NOT NULL THEN
    v_address_details := '📍 العنوان المؤكد:' || E'\n';
    v_address_details := v_address_details || '🏙️ المدينة: ' || v_found_city_name;
    
    IF v_found_region_name IS NOT NULL THEN
      v_address_details := v_address_details || E'\n🗺️ المنطقة: ' || v_found_region_name;
    END IF;
    
    IF v_customer_address IS NOT NULL AND trim(v_customer_address) != '' THEN
      v_address_details := v_address_details || E'\n🏠 التفاصيل: ' || v_customer_address;
    END IF;
    
    v_success_message := v_success_message || v_address_details;
  END IF;

  -- إرجاع النتيجة مع معلومات المدينة والمنطقة الذكية وmعرف ai_order_id
  RETURN jsonb_build_object(
    'success', true,
    'ai_order_id', v_ai_order_id,
    'customer_id', v_customer_id,
    'total_amount', v_total_amount + v_delivery_fee,
    'employee_id', v_employee_id,
    'detected_city_id', v_found_city_id,
    'detected_city_name', v_found_city_name,
    'detected_region_id', v_found_region_id,
    'detected_region_name', v_found_region_name,
    'success_message', v_success_message,
    'message', v_success_message
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'error_detail', SQLSTATE,
    'message', 'فشل في إنشاء الطلب الذكي: ' || SQLERRM
  );
END;
$$;