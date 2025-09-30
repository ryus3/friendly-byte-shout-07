-- إصلاح دالة معالجة الطلبات لاستخراج المنطقة والعلامة من سطر العنوان
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_message_text TEXT,
  p_chat_id BIGINT,
  p_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lines TEXT[];
  v_line TEXT;
  v_city TEXT := NULL;
  v_region TEXT := 'غير محدد';
  v_landmark TEXT := 'غير محدد';
  v_phone TEXT := NULL;
  v_customer_name TEXT := 'زبون تليغرام';
  v_products JSONB := '[]'::jsonb;
  v_total_amount NUMERIC := 0;
  v_order_id UUID;
  v_address_line TEXT := NULL;
  v_city_position INTEGER;
  v_after_city TEXT;
  v_parts TEXT[];
BEGIN
  -- تقسيم الرسالة إلى أسطر
  v_lines := string_to_array(trim(p_message_text), E'\n');
  
  -- البحث عن رقم الهاتف
  v_phone := extractPhoneFromText(p_message_text);
  
  -- معالجة كل سطر للبحث عن المدينة والعنوان
  FOREACH v_line IN ARRAY v_lines
  LOOP
    -- تخطي الأسطر الفارغة وأرقام الهواتف
    IF trim(v_line) = '' OR v_line ~ '07[0-9]{9}' THEN
      CONTINUE;
    END IF;
    
    -- البحث عن المدينة في السطر
    IF v_city IS NULL THEN
      SELECT c.name, position(lower(c.name) IN lower(v_line))
      INTO v_city, v_city_position
      FROM cities_cache c
      WHERE c.is_active = true
        AND lower(v_line) LIKE '%' || lower(c.name) || '%'
      ORDER BY length(c.name) DESC
      LIMIT 1;
      
      -- إذا وجدنا المدينة، هذا هو سطر العنوان
      IF v_city IS NOT NULL AND v_city != 'غير محدد' THEN
        v_address_line := trim(v_line);
        
        -- استخراج النص بعد المدينة
        v_after_city := trim(substring(v_line FROM v_city_position + length(v_city)));
        
        IF v_after_city IS NOT NULL AND v_after_city != '' THEN
          -- تقسيم النص المتبقي
          v_parts := string_to_array(v_after_city, ' ');
          
          -- محاولة البحث عن المنطقة في قاعدة البيانات
          IF array_length(v_parts, 1) >= 1 THEN
            SELECT r.name INTO v_region
            FROM regions_cache r
            WHERE r.city_id = (SELECT id FROM cities_cache WHERE name = v_city LIMIT 1)
              AND r.is_active = true
              AND (
                lower(v_after_city) LIKE lower(r.name) || '%'
                OR lower(v_after_city) LIKE '% ' || lower(r.name) || '%'
              )
            ORDER BY length(r.name) DESC
            LIMIT 1;
            
            IF v_region IS NOT NULL AND v_region != 'غير محدد' THEN
              -- أقرب نقطة دالة: باقي النص بعد حذف المنطقة
              v_landmark := trim(regexp_replace(v_after_city, '^' || v_region || '\s*', '', 'i'));
              IF v_landmark = '' THEN
                v_landmark := 'غير محدد';
              END IF;
            ELSE
              -- إذا لم نجد المنطقة، نأخذ أول كلمة/كلمتين كمنطقة
              IF array_length(v_parts, 1) = 1 THEN
                v_region := v_parts[1];
                v_landmark := 'غير محدد';
              ELSIF array_length(v_parts, 1) = 2 THEN
                v_region := v_parts[1];
                v_landmark := v_parts[2];
              ELSE
                v_region := v_parts[1] || ' ' || v_parts[2];
                v_landmark := array_to_string(v_parts[3:array_length(v_parts,1)], ' ');
              END IF;
            END IF;
          END IF;
        END IF;
        
        CONTINUE; -- هذا سطر العنوان، ننتقل للسطر التالي
      END IF;
    END IF;
    
    -- إذا لم يكن سطر عنوان ولا رقم هاتف، قد يكون اسم زبون
    IF v_city IS NOT NULL AND v_customer_name = 'زبون تليغرام' AND NOT (v_line ~ '[0-9]') THEN
      v_customer_name := trim(v_line);
    END IF;
  END LOOP;
  
  -- استخراج المنتجات
  v_products := extract_product_items_from_text(p_message_text);
  
  -- حساب المبلغ الإجمالي
  SELECT COALESCE(SUM((item->>'total_price')::numeric), 0)
  INTO v_total_amount
  FROM jsonb_array_elements(v_products) AS item;
  
  -- إضافة رسوم التوصيل (5000 د.ع)
  v_total_amount := v_total_amount + 5000;
  
  -- التحقق من توفر المنتجات
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_products) AS item
    WHERE (item->>'is_available')::boolean = false
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', (v_products->0->>'alternatives_message'),
      'extracted_data', jsonb_build_object(
        'city', COALESCE(v_city, 'غير محدد'),
        'region', v_region,
        'landmark', v_landmark,
        'phone', COALESCE(v_phone, 'غير محدد'),
        'customer_name', v_customer_name,
        'products', v_products
      )
    );
  END IF;
  
  -- إنشاء الطلب في جدول ai_orders
  INSERT INTO public.ai_orders (
    telegram_chat_id,
    customer_name,
    customer_phone,
    customer_city,
    customer_address,
    original_text,
    items,
    total_amount,
    status,
    created_by,
    order_data
  ) VALUES (
    p_chat_id,
    v_customer_name,
    v_phone,
    COALESCE(v_city, 'غير محدد'),
    COALESCE(v_address_line, 'غير محدد'),
    p_message_text,
    v_products,
    v_total_amount,
    'pending',
    COALESCE(p_employee_id::text, 'system'),
    jsonb_build_object(
      'city', COALESCE(v_city, 'غير محدد'),
      'region', v_region,
      'landmark', v_landmark,
      'phone', COALESCE(v_phone, 'غير محدد'),
      'products', v_products,
      'total_amount', v_total_amount
    )
  )
  RETURNING id INTO v_order_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم إنشاء الطلب بنجاح',
    'order_id', v_order_id,
    'extracted_data', jsonb_build_object(
      'city', COALESCE(v_city, 'غير محدد'),
      'region', v_region,
      'landmark', v_landmark,
      'phone', COALESCE(v_phone, 'غير محدد'),
      'customer_name', v_customer_name,
      'products', v_products,
      'total_amount', v_total_amount
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'حدث خطأ في معالجة الطلب: ' || SQLERRM,
      'extracted_data', jsonb_build_object(
        'city', 'غير محدد',
        'region', 'غير محدد',
        'landmark', 'غير محدد',
        'phone', 'غير محدد',
        'products', '[]'::jsonb
      )
    );
END;
$$;