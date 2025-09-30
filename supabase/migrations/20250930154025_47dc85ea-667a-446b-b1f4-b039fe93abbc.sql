-- تحسين استخراج أقرب نقطة دالة (landmark) في دالة process_telegram_order
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
  v_phone text;
  v_city text := 'غير محدد';
  v_region text := 'غير محدد';
  v_landmark text := 'غير محدد';
  v_product_items jsonb;
  v_lines text[];
  v_address_line text;
  v_city_result record;
  v_region_result record;
  v_temp_landmark text;
BEGIN
  RAISE NOTICE '📥 بدء معالجة طلب تليغرام: %', p_text;

  -- استخراج رقم الهاتف
  v_phone := public.extractphonefromtext(p_text);
  RAISE NOTICE '📱 رقم الهاتف: %', v_phone;

  -- تقسيم النص إلى أسطر
  v_lines := string_to_array(regexp_replace(p_text, E'\r\n|\r|\n', E'\n', 'g'), E'\n');
  
  -- البحث عن سطر العنوان (السطر الثاني عادة)
  IF array_length(v_lines, 1) >= 2 THEN
    v_address_line := TRIM(v_lines[2]);
  ELSE
    v_address_line := TRIM(v_lines[1]);
  END IF;
  
  RAISE NOTICE '📍 سطر العنوان: %', v_address_line;

  -- البحث الذكي عن المدينة
  SELECT city_name, confidence INTO v_city_result
  FROM public.smart_search_city(v_address_line)
  WHERE confidence >= 0.6
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_city_result.city_name IS NOT NULL THEN
    v_city := v_city_result.city_name;
    RAISE NOTICE '🏙️ تم التعرف على المدينة: % (ثقة: %)', v_city, v_city_result.confidence;
  ELSE
    RAISE NOTICE '⚠️ لم يتم التعرف على المدينة';
  END IF;

  -- البحث الذكي عن المنطقة
  SELECT region_name, confidence INTO v_region_result
  FROM public.smart_search_region(v_address_line, v_city)
  WHERE confidence >= 0.5
  ORDER BY confidence DESC
  LIMIT 1;

  IF v_region_result.region_name IS NOT NULL THEN
    v_region := v_region_result.region_name;
    RAISE NOTICE '📍 تم التعرف على المنطقة: % (ثقة: %)', v_region, v_region_result.confidence;
  ELSE
    RAISE NOTICE '⚠️ لم يتم التعرف على المنطقة';
  END IF;

  -- استخراج أقرب نقطة دالة بطريقة مبسطة
  IF v_city IS NOT NULL AND v_city != 'غير محدد' AND v_region IS NOT NULL AND v_region != 'غير محدد' THEN
    -- نسخ سطر العنوان
    v_temp_landmark := v_address_line;
    
    -- إزالة المدينة والمنطقة
    v_temp_landmark := REPLACE(v_temp_landmark, v_city, '');
    v_temp_landmark := REPLACE(v_temp_landmark, v_region, '');
    
    -- إزالة أرقام الهاتف
    v_temp_landmark := regexp_replace(v_temp_landmark, '(00)?9647[0-9]{9}|07[0-9]{9}', '', 'g');
    
    -- إزالة أسماء المنتجات الشائعة
    v_temp_landmark := regexp_replace(v_temp_landmark, '(بنطرون|بنطلون|بلوز|تيشرت|فستان|جاكيت|قميص|كنزة|معطف)', '', 'gi');
    
    -- إزالة الألوان الشائعة
    v_temp_landmark := regexp_replace(v_temp_landmark, '(احمر|اسود|ابيض|ازرق|اخضر|اصفر|وردي|بني|رمادي|بنفسجي|برتقالي)', '', 'gi');
    
    -- إزالة الأحجام الشائعة
    v_temp_landmark := regexp_replace(v_temp_landmark, '(xs|s|m|l|xl|xxl|xxxl|سمول|ميديم|لارج|اكس)', '', 'gi');
    
    -- إزالة الأرقام القصيرة (الكميات)
    v_temp_landmark := regexp_replace(v_temp_landmark, '\s+[0-9]{1,2}\s+', ' ', 'g');
    
    -- تنظيف المسافات والفواصل الزائدة
    v_temp_landmark := regexp_replace(v_temp_landmark, '\s+', ' ', 'g');
    v_temp_landmark := regexp_replace(v_temp_landmark, '^[\s،\-]+|[\s،\-]+$', '', 'g');
    v_temp_landmark := TRIM(v_temp_landmark);
    
    -- التحقق من وجود نص متبقي
    IF v_temp_landmark != '' AND v_temp_landmark IS NOT NULL AND LENGTH(v_temp_landmark) > 2 THEN
      v_landmark := v_temp_landmark;
      RAISE NOTICE '🎯 تم استخراج أقرب نقطة دالة: %', v_landmark;
    ELSE
      v_landmark := 'غير محدد';
      RAISE NOTICE 'ℹ️ لم يتم العثور على أقرب نقطة دالة';
    END IF;
  ELSE
    v_landmark := 'غير محدد';
    RAISE NOTICE 'ℹ️ تخطي استخراج أقرب نقطة دالة (المدينة أو المنطقة غير محددة)';
  END IF;

  -- استخراج عناصر المنتج
  v_product_items := public.extract_product_items_from_text(p_text);
  RAISE NOTICE '📦 عناصر المنتج: %', v_product_items;

  -- إرجاع النتيجة
  RETURN jsonb_build_object(
    'phone', v_phone,
    'city', v_city,
    'region', v_region,
    'landmark', v_landmark,
    'full_address', v_city || ' - ' || v_region || 
      CASE 
        WHEN v_landmark != 'غير محدد' THEN ' - ' || v_landmark 
        ELSE '' 
      END,
    'product_items', v_product_items,
    'chat_id', p_chat_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ خطأ في معالجة الطلب: % %', SQLSTATE, SQLERRM;
    RETURN jsonb_build_object(
      'error', true,
      'message', 'حدث خطأ في معالجة طلبك',
      'details', SQLERRM
    );
END;
$function$;