-- تحديث دالة auto_apply_city_benefits لإرسال إشعارات WhatsApp
DROP FUNCTION IF EXISTS auto_apply_city_benefits();

CREATE OR REPLACE FUNCTION auto_apply_city_benefits()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
  current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
  city_name TEXT;
  benefit_rec RECORD;
  customer_rec RECORD;
  discount_order RECORD;
  free_delivery_order RECORD;
  result jsonb := '[]'::jsonb;
  benefit_applied_count INT := 0;
BEGIN
  -- الحصول على المدينة الفائزة (الأكثر طلبات)
  SELECT co.city_name INTO city_name
  FROM city_order_stats co
  WHERE co.month = current_month AND co.year = current_year
  ORDER BY co.total_orders DESC
  LIMIT 1;

  IF city_name IS NULL THEN
    RETURN jsonb_build_object('message', 'لا توجد مدينة فائزة هذا الشهر', 'applied', 0);
  END IF;

  -- تطبيق مكافأة خصم + توصيل مجاني
  SELECT * INTO benefit_rec
  FROM city_monthly_benefits
  WHERE city_name = auto_apply_city_benefits.city_name
    AND month = current_month
    AND year = current_year
    AND benefit_type = 'discount_with_free_delivery'
    AND is_active = true
    AND current_usage < max_usage
  LIMIT 1;

  IF benefit_rec.id IS NOT NULL THEN
    -- اختيار زبون عشوائي من المدينة
    SELECT DISTINCT o.customer_name, o.customer_phone
    INTO customer_rec
    FROM orders o
    WHERE o.customer_city ILIKE '%' || city_name || '%'
      AND o.status IN ('delivered', 'completed')
      AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY RANDOM()
    LIMIT 1;

    IF customer_rec.customer_phone IS NOT NULL THEN
      -- الحصول على آخر طلب للزبون
      SELECT * INTO discount_order
      FROM orders o
      WHERE o.customer_phone = customer_rec.customer_phone
      ORDER BY o.created_at DESC
      LIMIT 1;

      IF discount_order.id IS NOT NULL THEN
        -- تطبيق الخصم والتوصيل المجاني
        UPDATE orders
        SET 
          discount = ROUND((total_amount - delivery_fee) * benefit_rec.benefit_value / 100),
          delivery_fee = 0,
          final_amount = ROUND((total_amount - delivery_fee) * (100 - benefit_rec.benefit_value) / 100)
        WHERE id = discount_order.id;

        -- تسجيل استخدام المكافأة
        INSERT INTO city_benefit_usage (
          city_benefit_id,
          customer_id,
          customer_phone,
          order_id,
          benefit_applied,
          notification_sent
        ) VALUES (
          benefit_rec.id,
          customer_rec.customer_name,
          customer_rec.customer_phone,
          discount_order.id,
          benefit_rec.benefit_value,
          false
        );

        -- تحديث عداد الاستخدام
        UPDATE city_monthly_benefits
        SET current_usage = current_usage + 1
        WHERE id = benefit_rec.id;

        benefit_applied_count := benefit_applied_count + 1;

        -- إرسال إشعار WhatsApp
        PERFORM net.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/send-city-benefit-notification',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true),
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'orderId', discount_order.id,
            'benefitType', benefit_rec.benefit_type,
            'benefitValue', benefit_rec.benefit_value,
            'cityName', city_name
          )
        );

        result := result || jsonb_build_object(
          'benefit', 'discount_with_free_delivery',
          'customer', customer_rec.customer_name,
          'order_id', discount_order.tracking_number,
          'discount', benefit_rec.benefit_value || '%'
        );
      END IF;
    END IF;
  END IF;

  -- تطبيق مكافأة توصيل مجاني
  SELECT * INTO benefit_rec
  FROM city_monthly_benefits
  WHERE city_name = auto_apply_city_benefits.city_name
    AND month = current_month
    AND year = current_year
    AND benefit_type = 'free_delivery'
    AND is_active = true
    AND current_usage < max_usage
  LIMIT 1;

  IF benefit_rec.id IS NOT NULL THEN
    -- اختيار زبون آخر عشوائي
    SELECT DISTINCT o.customer_name, o.customer_phone
    INTO customer_rec
    FROM orders o
    WHERE o.customer_city ILIKE '%' || city_name || '%'
      AND o.status IN ('delivered', 'completed')
      AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND o.customer_phone != COALESCE((
        SELECT customer_phone FROM city_benefit_usage 
        WHERE city_benefit_id IN (
          SELECT id FROM city_monthly_benefits 
          WHERE month = current_month AND year = current_year
        )
        LIMIT 1
      ), '')
    ORDER BY RANDOM()
    LIMIT 1;

    IF customer_rec.customer_phone IS NOT NULL THEN
      SELECT * INTO free_delivery_order
      FROM orders o
      WHERE o.customer_phone = customer_rec.customer_phone
      ORDER BY o.created_at DESC
      LIMIT 1;

      IF free_delivery_order.id IS NOT NULL THEN
        -- تطبيق التوصيل المجاني
        UPDATE orders
        SET 
          delivery_fee = 0,
          final_amount = total_amount - delivery_fee
        WHERE id = free_delivery_order.id;

        INSERT INTO city_benefit_usage (
          city_benefit_id,
          customer_id,
          customer_phone,
          order_id,
          benefit_applied,
          notification_sent
        ) VALUES (
          benefit_rec.id,
          customer_rec.customer_name,
          customer_rec.customer_phone,
          free_delivery_order.id,
          0,
          false
        );

        UPDATE city_monthly_benefits
        SET current_usage = current_usage + 1
        WHERE id = benefit_rec.id;

        benefit_applied_count := benefit_applied_count + 1;

        -- إرسال إشعار WhatsApp
        PERFORM net.http_post(
          url := current_setting('app.supabase_url', true) || '/functions/v1/send-city-benefit-notification',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true),
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'orderId', free_delivery_order.id,
            'benefitType', benefit_rec.benefit_type,
            'benefitValue', 0,
            'cityName', city_name
          )
        );

        result := result || jsonb_build_object(
          'benefit', 'free_delivery',
          'customer', customer_rec.customer_name,
          'order_id', free_delivery_order.tracking_number
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'city', city_name,
    'applied', benefit_applied_count,
    'benefits', result
  );
END;
$$;