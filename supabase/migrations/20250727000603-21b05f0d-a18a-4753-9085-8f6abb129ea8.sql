-- تحسين النظام ليصبح تلقائي وذكي أكثر

-- دالة لاختيار مدينة تلقائياً وتطبيق المزايا على طلبات عشوائية
CREATE OR REPLACE FUNCTION public.auto_apply_city_benefits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
  selected_city TEXT;
  discount_order RECORD;
  delivery_order RECORD;
  result jsonb;
BEGIN
  -- التحقق من وجود مزايا نشطة
  SELECT city_name INTO selected_city
  FROM public.city_monthly_benefits
  WHERE month = current_month 
  AND year = current_year
  AND is_active = true
  LIMIT 1;
  
  IF selected_city IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'لا توجد مزايا نشطة حالياً');
  END IF;
  
  -- اختيار طلب عشوائي للخصم (لم يتم تطبيق خصم عليه من قبل)
  SELECT o.* INTO discount_order
  FROM public.orders o
  WHERE LOWER(o.customer_city) = LOWER(selected_city)
  AND o.status IN ('pending', 'confirmed', 'shipped')
  AND o.total_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.city_benefit_usage cbu
    JOIN public.city_monthly_benefits cmb ON cbu.city_benefit_id = cmb.id
    WHERE cbu.order_id = o.id
    AND cmb.benefit_type = 'discount'
  )
  ORDER BY RANDOM()
  LIMIT 1;
  
  -- اختيار طلب عشوائي آخر للتوصيل المجاني
  SELECT o.* INTO delivery_order
  FROM public.orders o
  WHERE LOWER(o.customer_city) = LOWER(selected_city)
  AND o.status IN ('pending', 'confirmed', 'shipped')
  AND o.delivery_fee > 0
  AND o.id != COALESCE(discount_order.id, 'invalid'::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM public.city_benefit_usage cbu
    JOIN public.city_monthly_benefits cmb ON cbu.city_benefit_id = cmb.id
    WHERE cbu.order_id = o.id
    AND cmb.benefit_type = 'free_delivery'
  )
  ORDER BY RANDOM()
  LIMIT 1;
  
  result := jsonb_build_object(
    'city_name', selected_city,
    'benefits_applied', jsonb_build_array()
  );
  
  -- تطبيق خصم على الطلب المختار
  IF discount_order.id IS NOT NULL THEN
    -- تطبيق خصم 10%
    UPDATE public.orders
    SET 
      discount = GREATEST(discount, total_amount * 0.1),
      final_amount = total_amount + delivery_fee - GREATEST(discount, total_amount * 0.1),
      updated_at = now()
    WHERE id = discount_order.id;
    
    -- تسجيل استخدام المزايا
    INSERT INTO public.city_benefit_usage (
      city_benefit_id,
      order_id,
      customer_id,
      customer_phone,
      benefit_applied
    )
    SELECT 
      cmb.id,
      discount_order.id,
      discount_order.customer_id,
      discount_order.customer_phone,
      discount_order.total_amount * 0.1
    FROM public.city_monthly_benefits cmb
    WHERE cmb.city_name = selected_city
    AND cmb.month = current_month
    AND cmb.year = current_year
    AND cmb.benefit_type = 'discount';
    
    -- تحديث عداد الاستخدام
    UPDATE public.city_monthly_benefits
    SET current_usage = current_usage + 1
    WHERE city_name = selected_city
    AND month = current_month
    AND year = current_year
    AND benefit_type = 'discount';
    
    result := jsonb_set(
      result, 
      '{benefits_applied}', 
      (result->'benefits_applied') || jsonb_build_object(
        'type', 'discount',
        'order_number', discount_order.order_number,
        'customer_name', discount_order.customer_name,
        'amount', discount_order.total_amount * 0.1
      )
    );
    
    -- إشعار للعميل
    INSERT INTO public.customer_notifications_sent (
      customer_id,
      notification_type,
      message,
      sent_via,
      success
    ) VALUES (
      discount_order.customer_id,
      'city_discount_applied',
      '🎉 تهانينا! حصلت على خصم 10% كونك من مدينة ' || selected_city || ' المختارة هذا الشهر! رقم الطلب: ' || discount_order.order_number,
      'pending',
      false
    );
  END IF;
  
  -- تطبيق التوصيل المجاني على الطلب المختار
  IF delivery_order.id IS NOT NULL THEN
    -- تطبيق توصيل مجاني
    UPDATE public.orders
    SET 
      delivery_fee = 0,
      final_amount = total_amount - discount,
      updated_at = now()
    WHERE id = delivery_order.id;
    
    -- تسجيل استخدام المزايا
    INSERT INTO public.city_benefit_usage (
      city_benefit_id,
      order_id,
      customer_id,
      customer_phone,
      benefit_applied
    )
    SELECT 
      cmb.id,
      delivery_order.id,
      delivery_order.customer_id,
      delivery_order.customer_phone,
      delivery_order.delivery_fee
    FROM public.city_monthly_benefits cmb
    WHERE cmb.city_name = selected_city
    AND cmb.month = current_month
    AND cmb.year = current_year
    AND cmb.benefit_type = 'free_delivery';
    
    -- تحديث عداد الاستخدام
    UPDATE public.city_monthly_benefits
    SET current_usage = current_usage + 1
    WHERE city_name = selected_city
    AND month = current_month
    AND year = current_year
    AND benefit_type = 'free_delivery';
    
    result := jsonb_set(
      result, 
      '{benefits_applied}', 
      (result->'benefits_applied') || jsonb_build_object(
        'type', 'free_delivery',
        'order_number', delivery_order.order_number,
        'customer_name', delivery_order.customer_name,
        'amount', 0
      )
    );
    
    -- إشعار للعميل
    INSERT INTO public.customer_notifications_sent (
      customer_id,
      notification_type,
      message,
      sent_via,
      success
    ) VALUES (
      delivery_order.customer_id,
      'free_delivery_applied',
      '🚚 تهانينا! حصلت على توصيل مجاني كونك من مدينة ' || selected_city || ' المختارة هذا الشهر! رقم الطلب: ' || delivery_order.order_number,
      'pending',
      false
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'city_name', selected_city,
    'benefits_applied', result->'benefits_applied'
  );
END;
$$;

-- دالة لإنشاء إشعار للعميل عند شحن الطلب إذا حصل على مزايا
CREATE OR REPLACE FUNCTION public.notify_customer_on_shipping()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  benefit_info RECORD;
  notification_message TEXT := '';
BEGIN
  -- التحقق من تغيير حالة الطلب إلى "shipped"
  IF NEW.status = 'shipped' AND OLD.status != 'shipped' THEN
    
    -- البحث عن المزايا المطبقة على هذا الطلب
    FOR benefit_info IN
      SELECT 
        cmb.benefit_type,
        cmb.benefit_value,
        cmb.city_name,
        cbu.benefit_applied
      FROM public.city_benefit_usage cbu
      JOIN public.city_monthly_benefits cmb ON cbu.city_benefit_id = cmb.id
      WHERE cbu.order_id = NEW.id
    LOOP
      IF benefit_info.benefit_type = 'discount' THEN
        notification_message := notification_message || 
          '🎉 تم تطبيق خصم ' || benefit_info.benefit_value || '% (' || 
          benefit_info.benefit_applied || ' د.ع) لكونك من مدينة ' || 
          benefit_info.city_name || ' المختارة هذا الشهر! ';
      ELSIF benefit_info.benefit_type = 'free_delivery' THEN
        notification_message := notification_message || 
          '🚚 تم توفير التوصيل المجاني لكونك من مدينة ' || 
          benefit_info.city_name || ' المختارة هذا الشهر! ';
      END IF;
    END LOOP;
    
    -- إرسال الإشعار إذا كان هناك مزايا
    IF notification_message != '' THEN
      INSERT INTO public.customer_notifications_sent (
        customer_id,
        notification_type,
        message,
        sent_via,
        success
      ) VALUES (
        NEW.customer_id,
        'shipping_with_benefits',
        'تم شحن طلبك رقم ' || NEW.order_number || '! ' || notification_message || 
        '🌟 شكراً لثقتكم بنا!',
        'pending',
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الترايجر
DROP TRIGGER IF EXISTS notify_customer_shipping_benefits ON public.orders;
CREATE TRIGGER notify_customer_shipping_benefits
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_shipping();