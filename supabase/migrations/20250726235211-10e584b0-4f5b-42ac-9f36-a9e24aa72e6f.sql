-- إنشاء دوال النظام مع إصلاح مشاكل الأمان

-- دالة لتطبيق نظام المدن المتطور
CREATE OR REPLACE FUNCTION public.setup_monthly_city_benefits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
  prev_month INTEGER := CASE WHEN current_month = 1 THEN 12 ELSE current_month - 1 END;
  prev_year INTEGER := CASE WHEN current_month = 1 THEN current_year - 1 ELSE current_year END;
  selected_city TEXT;
  cities_count INTEGER;
BEGIN
  -- التحقق من عدم وجود مزايا لهذا الشهر
  SELECT COUNT(*) INTO cities_count
  FROM public.city_monthly_benefits 
  WHERE month = current_month AND year = current_year;
  
  IF cities_count > 0 THEN
    RETURN jsonb_build_object('message', 'تم تعيين مزايا المدن لهذا الشهر مسبقاً');
  END IF;
  
  -- اختيار أفضل مدينة من الشهر السابق
  SELECT city_name INTO selected_city
  FROM public.city_order_stats
  WHERE month = prev_month 
  AND year = prev_year
  AND total_orders >= 2
  ORDER BY total_orders DESC, total_amount DESC, RANDOM()
  LIMIT 1;
  
  IF selected_city IS NOT NULL THEN
    -- إضافة خصم 10% (طلب واحد)
    INSERT INTO public.city_monthly_benefits (
      city_name, month, year, benefit_type, benefit_value, max_usage
    ) VALUES (
      selected_city, current_month, current_year, 'discount', 10, 1
    );
    
    -- إضافة توصيل مجاني (طلب واحد آخر)
    INSERT INTO public.city_monthly_benefits (
      city_name, month, year, benefit_type, benefit_value, max_usage
    ) VALUES (
      selected_city, current_month, current_year, 'free_delivery', 100, 1
    );
    
    -- إشعار عام
    INSERT INTO public.notifications (
      title, message, type, priority, data
    ) VALUES (
      'مزايا المدينة الشهرية',
      'تم اختيار مدينة ' || selected_city || ' للحصول على مزايا خاصة: خصم 10% + توصيل مجاني',
      'city_benefits_selected',
      'high',
      jsonb_build_object(
        'city_name', selected_city,
        'benefits', jsonb_build_array(
          jsonb_build_object('type', 'discount', 'value', '10%'),
          jsonb_build_object('type', 'free_delivery', 'value', 'مجاني')
        )
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'city_name', selected_city,
      'benefits', 'خصم 10% + توصيل مجاني'
    );
  ELSE
    RETURN jsonb_build_object('message', 'لا توجد مدن مؤهلة لهذا الشهر');
  END IF;
END;
$$;

-- دالة للتحقق من مزايا المدينة للطلب
CREATE OR REPLACE FUNCTION public.check_city_benefits(p_city_name text, p_order_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
  discount_benefit RECORD;
  delivery_benefit RECORD;
  available_benefits jsonb := '[]'::jsonb;
BEGIN
  -- فحص خصم النسبة المئوية
  SELECT * INTO discount_benefit
  FROM public.city_monthly_benefits
  WHERE LOWER(city_name) = LOWER(p_city_name)
  AND month = current_month 
  AND year = current_year
  AND benefit_type = 'discount'
  AND current_usage < max_usage
  AND is_active = true;
  
  -- فحص التوصيل المجاني
  SELECT * INTO delivery_benefit
  FROM public.city_monthly_benefits
  WHERE LOWER(city_name) = LOWER(p_city_name)
  AND month = current_month 
  AND year = current_year
  AND benefit_type = 'free_delivery'
  AND current_usage < max_usage
  AND is_active = true;
  
  -- إضافة المزايا المتاحة
  IF discount_benefit.id IS NOT NULL THEN
    available_benefits := available_benefits || jsonb_build_object(
      'type', 'discount',
      'value', discount_benefit.benefit_value,
      'amount', p_order_amount * (discount_benefit.benefit_value / 100),
      'description', 'خصم ' || discount_benefit.benefit_value || '% على طلبك',
      'benefit_id', discount_benefit.id
    );
  END IF;
  
  IF delivery_benefit.id IS NOT NULL THEN
    available_benefits := available_benefits || jsonb_build_object(
      'type', 'free_delivery',
      'value', delivery_benefit.benefit_value,
      'amount', 0,
      'description', 'توصيل مجاني لطلبك',
      'benefit_id', delivery_benefit.id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'has_benefits', jsonb_array_length(available_benefits) > 0,
    'city_name', p_city_name,
    'available_benefits', available_benefits,
    'message', CASE 
      WHEN jsonb_array_length(available_benefits) > 0 
      THEN 'تهانينا! مدينتك ' || p_city_name || ' لديها مزايا خاصة هذا الشهر!'
      ELSE 'لا توجد مزايا متاحة لمدينتك حالياً'
    END
  );
END;
$$;

-- دالة لتطبيق المزايا على الطلب
CREATE OR REPLACE FUNCTION public.apply_city_benefit(p_benefit_id uuid, p_order_id uuid, p_customer_id uuid, p_customer_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  benefit_record RECORD;
  order_record RECORD;
  applied_amount NUMERIC := 0;
BEGIN
  -- التحقق من المزايا
  SELECT * INTO benefit_record
  FROM public.city_monthly_benefits
  WHERE id = p_benefit_id
  AND current_usage < max_usage
  AND is_active = true;
  
  IF benefit_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'المزايا غير متاحة أو تم استنفادها');
  END IF;
  
  -- التحقق من الطلب
  SELECT * INTO order_record
  FROM public.orders
  WHERE id = p_order_id;
  
  IF order_record.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'الطلب غير موجود');
  END IF;
  
  -- حساب المبلغ المطبق
  IF benefit_record.benefit_type = 'discount' THEN
    applied_amount := order_record.total_amount * (benefit_record.benefit_value / 100);
  ELSIF benefit_record.benefit_type = 'free_delivery' THEN
    applied_amount := order_record.delivery_fee;
  END IF;
  
  -- تسجيل الاستخدام
  INSERT INTO public.city_benefit_usage (
    city_benefit_id, order_id, customer_id, customer_phone, benefit_applied
  ) VALUES (
    p_benefit_id, p_order_id, p_customer_id, p_customer_phone, applied_amount
  );
  
  -- تحديث عداد الاستخدام
  UPDATE public.city_monthly_benefits
  SET current_usage = current_usage + 1,
      updated_at = now()
  WHERE id = p_benefit_id;
  
  -- إضافة إشعار
  INSERT INTO public.notifications (
    title, message, type, data
  ) VALUES (
    'تم تطبيق مزايا المدينة',
    'تم تطبيق ' || 
    CASE 
      WHEN benefit_record.benefit_type = 'discount' THEN 'خصم ' || benefit_record.benefit_value || '%'
      WHEN benefit_record.benefit_type = 'free_delivery' THEN 'توصيل مجاني'
      ELSE 'مزايا خاصة'
    END || 
    ' على طلب من مدينة ' || benefit_record.city_name,
    'city_benefit_applied',
    jsonb_build_object(
      'order_id', p_order_id,
      'city_name', benefit_record.city_name,
      'benefit_type', benefit_record.benefit_type,
      'applied_amount', applied_amount
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'benefit_type', benefit_record.benefit_type,
    'applied_amount', applied_amount,
    'message', 'تم تطبيق المزايا بنجاح'
  );
END;
$$;