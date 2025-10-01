-- إصلاح دالة معالجة الطلبات الذكية من تليغرام
CREATE OR REPLACE FUNCTION process_telegram_order(
  p_employee_code TEXT,
  p_message_text TEXT,
  p_telegram_chat_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_id UUID;
  v_customer_phone TEXT;
  v_customer_name TEXT := 'زبون تليغرام';
  v_customer_city TEXT;
  v_customer_address TEXT;
  v_product_items JSONB;
  v_order_id UUID;
  v_total_amount NUMERIC := 0;
  v_city_result RECORD;
  v_region_result RECORD;
  v_existing_customer RECORD;
  v_delivery_fee NUMERIC := 5000;
BEGIN
  RAISE NOTICE '📥 بدء معالجة طلب تليغرام: %', p_message_text;
  
  -- 1. البحث عن الموظف
  SELECT user_id INTO v_employee_id
  FROM employee_telegram_codes
  WHERE telegram_code = p_employee_code
    AND is_active = true
  LIMIT 1;
  
  IF v_employee_id IS NULL THEN
    RAISE NOTICE '⚠️ لم يتم العثور على موظف برمز: %', p_employee_code;
    SELECT id INTO v_employee_id FROM profiles WHERE email = 'admin@admin.com' LIMIT 1;
  END IF;
  
  -- 2. استخراج رقم الهاتف
  v_customer_phone := extractphonefromtext(p_message_text);
  RAISE NOTICE '📱 رقم الهاتف المستخرج: %', v_customer_phone;
  
  -- 3. البحث عن اسم الزبون في جدول العملاء
  IF v_customer_phone IS NOT NULL AND v_customer_phone != 'غير محدد' THEN
    SELECT id, name, city, address 
    INTO v_existing_customer
    FROM customers
    WHERE phone = v_customer_phone
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_existing_customer.name IS NOT NULL THEN
      v_customer_name := v_existing_customer.name;
      RAISE NOTICE '👤 تم العثور على اسم الزبون: %', v_customer_name;
    END IF;
  END IF;
  
  -- 4. استخراج المدينة باستخدام البحث الذكي (تقليل حد الثقة إلى 0.5)
  SELECT city_id, city_name, confidence INTO v_city_result
  FROM smart_search_city(p_message_text)
  WHERE confidence >= 0.5
  ORDER BY confidence DESC
  LIMIT 1;
  
  IF v_city_result.city_name IS NOT NULL THEN
    v_customer_city := v_city_result.city_name;
    RAISE NOTICE '🏙️ المدينة المستخرجة: % (ثقة: %)', v_customer_city, v_city_result.confidence;
  ELSE
    v_customer_city := NULL;
    RAISE NOTICE '⚠️ لم يتم العثور على مدينة في النص';
  END IF;
  
  -- 5. استخراج العنوان/المنطقة
  IF v_customer_city IS NOT NULL THEN
    -- البحث عن منطقة في cache المناطق
    SELECT name INTO v_region_result
    FROM regions_cache
    WHERE city_id = v_city_result.city_id
      AND is_active = true
      AND (
        lower(name) = ANY(string_to_array(lower(p_message_text), ' '))
        OR lower(p_message_text) LIKE '%' || lower(name) || '%'
      )
    ORDER BY 
      CASE 
        WHEN lower(p_message_text) LIKE lower(name) || '%' THEN 1
        WHEN lower(p_message_text) LIKE '%' || lower(name) || '%' THEN 2
        ELSE 3
      END
    LIMIT 1;
    
    IF v_region_result.name IS NOT NULL THEN
      v_customer_address := v_region_result.name;
      RAISE NOTICE '📍 المنطقة المستخرجة من cache: %', v_customer_address;
    ELSE
      -- استخراج المنطقة من النص (حذف المدينة ورقم الهاتف والمنتجات)
      v_customer_address := extract_actual_address(
        regexp_replace(
          regexp_replace(
            regexp_replace(p_message_text, v_customer_city, '', 'gi'),
            v_customer_phone, '', 'g'
          ),
          '(برشلونة|ارجنتين|سوت شيك|ريال|باريس|ازرق|احمر|اصفر|اخضر|اسود|ابيض|سمول|ميديم|لارج|xl|xxl|s|m|l)', 
          '', 'gi'
        )
      );
      RAISE NOTICE '📍 المنطقة المستخرجة من النص: %', v_customer_address;
    END IF;
  ELSE
    v_customer_address := extract_actual_address(p_message_text);
    RAISE NOTICE '📍 العنوان الكامل المستخرج: %', v_customer_address;
  END IF;
  
  -- 6. استخراج المنتجات
  v_product_items := extract_product_items_from_text(p_message_text);
  RAISE NOTICE '🛍️ المنتجات المستخرجة: %', v_product_items;
  
  -- 7. التحقق من توفر المنتجات
  IF jsonb_array_length(v_product_items) > 0 THEN
    DECLARE
      v_item JSONB;
      v_has_unavailable BOOLEAN := false;
      v_alternatives_msg TEXT := '';
    BEGIN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
      LOOP
        IF (v_item->>'is_available')::boolean = false THEN
          v_has_unavailable := true;
          v_alternatives_msg := v_item->>'alternatives_message';
          EXIT;
        END IF;
        
        v_total_amount := v_total_amount + COALESCE((v_item->>'total_price')::numeric, 0);
      END LOOP;
      
      -- إذا كان هناك منتج غير متوفر، نرجع رسالة الخطأ
      IF v_has_unavailable THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', v_alternatives_msg,
          'product_items', v_product_items
        );
      END IF;
    END;
  END IF;
  
  -- 8. إضافة رسوم التوصيل
  v_total_amount := v_total_amount + v_delivery_fee;
  RAISE NOTICE '💰 المبلغ الإجمالي (شامل التوصيل): %', v_total_amount;
  
  -- 9. إنشاء الطلب
  INSERT INTO orders (
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    total_amount,
    final_amount,
    delivery_fee,
    status,
    created_by,
    notes
  ) VALUES (
    v_customer_name,
    v_customer_phone,
    v_customer_city,
    v_customer_address,
    v_total_amount - v_delivery_fee,
    v_total_amount,
    v_delivery_fee,
    'pending',
    v_employee_id,
    'طلب من تليغرام: ' || p_message_text
  )
  RETURNING id INTO v_order_id;
  
  -- 10. إضافة عناصر الطلب
  DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
  BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_product_items)
    LOOP
      -- البحث عن المنتج والمتغير
      SELECT p.id INTO v_product_id
      FROM products p
      WHERE lower(p.name) = lower(v_item->>'product_name')
      LIMIT 1;
      
      IF v_product_id IS NOT NULL THEN
        SELECT pv.id INTO v_variant_id
        FROM product_variants pv
        JOIN colors c ON pv.color_id = c.id
        JOIN sizes s ON pv.size_id = s.id
        WHERE pv.product_id = v_product_id
          AND lower(c.name) = lower(COALESCE(v_item->>'color', 'افتراضي'))
          AND lower(s.name) = lower(COALESCE(v_item->>'size', 'افتراضي'))
        LIMIT 1;
        
        INSERT INTO order_items (
          order_id,
          product_id,
          variant_id,
          quantity,
          unit_price,
          total_price
        ) VALUES (
          v_order_id,
          v_product_id,
          v_variant_id,
          COALESCE((v_item->>'quantity')::integer, 1),
          COALESCE((v_item->>'price')::numeric, 0),
          COALESCE((v_item->>'total_price')::numeric, 0)
        );
      END IF;
    END LOOP;
  END;
  
  RAISE NOTICE '✅ تم إنشاء الطلب بنجاح: %', v_order_id;
  
  -- 11. إرجاع النتيجة
  RETURN jsonb_build_object(
    'success', true,
    'message', '✅ تم إنشاء الطلب بنجاح',
    'order_id', v_order_id,
    'customer_name', v_customer_name,
    'customer_phone', v_customer_phone,
    'customer_city', v_customer_city,
    'customer_address', v_customer_address,
    'product_items', v_product_items,
    'total_amount', v_total_amount
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'message', '❌ حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'error', SQLERRM
    );
END;
$$;