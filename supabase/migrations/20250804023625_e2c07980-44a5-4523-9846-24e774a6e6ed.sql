-- تحديث دالة دمج العملاء لنظام النقاط الصحيح
CREATE OR REPLACE FUNCTION migrate_existing_customers_to_phone_loyalty()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  phone_group RECORD;
  total_orders_count INTEGER;
  total_spent_amount NUMERIC;
  total_loyalty_points INTEGER;
  tier_id_to_assign UUID;
  first_order_date TIMESTAMP WITH TIME ZONE;
  last_order_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- حذف البيانات المكررة السابقة
  DELETE FROM customer_phone_loyalty;
  
  -- التكرار عبر كل مجموعة هاتف منظفة
  FOR phone_group IN 
    SELECT 
      -- تنظيف رقم الهاتف
      regexp_replace(
        regexp_replace(
          regexp_replace(
            COALESCE(c.phone, ''), 
            '[\s\-\(\)]', '', 'g'
          ), 
          '^(\+964|00964)', '', 'g'
        ), 
        '^0', '', 'g'
      ) as cleaned_phone,
      -- أخذ أول عميل كمرجع للبيانات الأساسية
      MIN(c.id) as representative_customer_id,
      MAX(c.name) as customer_name,
      MAX(c.city) as customer_city,
      MAX(c.province) as customer_province,
      MAX(c.phone) as original_phone
    FROM customers c
    WHERE c.phone IS NOT NULL 
    AND TRIM(c.phone) != ''
    GROUP BY regexp_replace(
      regexp_replace(
        regexp_replace(
          COALESCE(c.phone, ''), 
          '[\s\-\(\)]', '', 'g'
        ), 
        '^(\+964|00964)', '', 'g'
      ), 
      '^0', '', 'g'
    )
    HAVING regexp_replace(
      regexp_replace(
        regexp_replace(
          COALESCE(MAX(c.phone), ''), 
          '[\s\-\(\)]', '', 'g'
        ), 
        '^(\+964|00964)', '', 'g'
      ), 
      '^0', '', 'g'
    ) != ''
  LOOP
    -- حساب إجمالي الطلبات المكتملة والمستلمة لهذا الرقم
    SELECT 
      COUNT(DISTINCT o.id),
      COALESCE(SUM(o.total_amount), 0),
      MIN(o.created_at),
      MAX(o.created_at)
    INTO 
      total_orders_count, 
      total_spent_amount,
      first_order_date,
      last_order_date
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE regexp_replace(
      regexp_replace(
        regexp_replace(
          COALESCE(c.phone, ''), 
          '[\s\-\(\)]', '', 'g'
        ), 
        '^(\+964|00964)', '', 'g'
      ), 
      '^0', '', 'g'
    ) = phone_group.cleaned_phone
    AND o.status IN ('completed', 'delivered')
    AND o.receipt_received = true;
    
    -- حساب النقاط: 250 نقطة لكل طلب مكتمل
    total_loyalty_points := total_orders_count * 250;
    
    -- تحديد المستوى حسب النقاط
    SELECT id INTO tier_id_to_assign
    FROM loyalty_tiers
    WHERE points_required <= total_loyalty_points
    ORDER BY points_required DESC
    LIMIT 1;
    
    -- إدراج البيانات الموحدة
    INSERT INTO customer_phone_loyalty (
      phone_number,
      original_phone,
      customer_name,
      customer_city,
      customer_province,
      total_points,
      current_tier_id,
      total_spent,
      total_orders,
      first_order_date,
      last_order_date,
      points_expiry_date
    ) VALUES (
      phone_group.cleaned_phone,
      phone_group.original_phone,
      phone_group.customer_name,
      phone_group.customer_city,
      phone_group.customer_province,
      total_loyalty_points,
      tier_id_to_assign,
      total_spent_amount,
      total_orders_count,
      first_order_date,
      last_order_date,
      CASE 
        WHEN total_loyalty_points > 0 THEN now() + INTERVAL '3 months'
        ELSE NULL
      END
    );
    
    RAISE NOTICE 'دمج العميل - هاتف: %, طلبات: %, نقاط: %', 
                 phone_group.cleaned_phone, total_orders_count, total_loyalty_points;
    
  END LOOP;
  
  RAISE NOTICE 'تم دمج جميع العملاء بنجاح حسب رقم الهاتف مع النقاط الصحيحة';
END;
$function$;

-- تشغيل دالة الدمج
SELECT migrate_existing_customers_to_phone_loyalty();