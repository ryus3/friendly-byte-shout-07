-- تصحيح نظام حساب النقاط ليكون 250 نقطة لكل طلب مكتمل بدلاً من حساب النقاط على أساس المبلغ

CREATE OR REPLACE FUNCTION public.update_customer_phone_loyalty(
  p_phone text, 
  p_customer_name text DEFAULT NULL::text, 
  p_customer_city text DEFAULT NULL::text, 
  p_customer_province text DEFAULT NULL::text, 
  p_order_amount numeric DEFAULT 0, 
  p_order_date timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone TEXT;
  loyalty_record RECORD;
  points_to_add INTEGER;
  new_tier_id UUID;
  loyalty_id UUID;
BEGIN
  -- تطبيع رقم الهاتف
  normalized_phone := normalize_phone_number(p_phone);
  
  -- حساب النقاط (250 نقطة لكل طلب مكتمل)
  points_to_add := public.calculate_loyalty_points_per_order();
  
  -- البحث عن سجل الولاء الموجود أو إنشاء جديد
  SELECT * INTO loyalty_record 
  FROM public.customer_phone_loyalty 
  WHERE phone_number = normalized_phone;
  
  IF loyalty_record IS NULL THEN
    -- إنشاء سجل جديد
    INSERT INTO public.customer_phone_loyalty (
      phone_number,
      original_phone,
      customer_name,
      customer_city,
      customer_province,
      total_points,
      total_spent,
      total_orders,
      first_order_date,
      last_order_date,
      points_expiry_date
    ) VALUES (
      normalized_phone,
      p_phone,
      p_customer_name,
      p_customer_city,
      p_customer_province,
      points_to_add,
      p_order_amount,
      1,
      p_order_date,
      p_order_date,
      p_order_date + INTERVAL '3 months'
    ) RETURNING id INTO loyalty_id;
  ELSE
    -- تحديث السجل الموجود
    UPDATE public.customer_phone_loyalty 
    SET 
      total_points = total_points + points_to_add,
      total_spent = total_spent + p_order_amount,
      total_orders = total_orders + 1,
      last_order_date = p_order_date,
      customer_name = COALESCE(p_customer_name, customer_name),
      customer_city = COALESCE(p_customer_city, customer_city),
      customer_province = COALESCE(p_customer_province, customer_province),
      points_expiry_date = p_order_date + INTERVAL '3 months',
      updated_at = now()
    WHERE phone_number = normalized_phone
    RETURNING id INTO loyalty_id;
  END IF;
  
  -- تحديث مستوى الولاء
  SELECT id INTO new_tier_id
  FROM public.loyalty_tiers
  WHERE points_required <= (
    SELECT total_points FROM public.customer_phone_loyalty WHERE id = loyalty_id
  )
  ORDER BY points_required DESC
  LIMIT 1;
  
  IF new_tier_id IS NOT NULL THEN
    UPDATE public.customer_phone_loyalty 
    SET current_tier_id = new_tier_id,
        last_tier_upgrade = CASE 
          WHEN current_tier_id != new_tier_id THEN now() 
          ELSE last_tier_upgrade 
        END
    WHERE id = loyalty_id;
  END IF;
  
  RETURN loyalty_id;
END;
$function$;

-- تحديث دالة ترحيل البيانات الموجودة لتحسب 250 نقطة لكل طلب مكتمل
CREATE OR REPLACE FUNCTION public.migrate_existing_customers_to_phone_loyalty()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_record RECORD;
  normalized_phone TEXT;
  loyalty_id UUID;
  tier_id UUID;
  total_points INTEGER;
BEGIN
  -- إفراغ الجدول أولاً لتجنب التكرار
  DELETE FROM public.customer_phone_loyalty;
  
  -- الحصول على العملاء مجمعين حسب رقم الهاتف المطبع
  FOR customer_record IN
    SELECT 
      regexp_replace(regexp_replace(regexp_replace(
        COALESCE(c.phone, ''), 
        '[\s\-\(\)]', '', 'g'
      ), '^(\+964|00964)', '', 'g'), '^0', '', 'g') as normalized_phone,
      c.phone as original_phone,
      -- أخذ آخر اسم عميل لهذا الرقم
      (array_agg(c.name ORDER BY c.created_at DESC))[1] as customer_name,
      -- أخذ آخر مدينة لهذا الرقم
      (array_agg(c.city ORDER BY c.created_at DESC))[1] as customer_city,
      (array_agg(c.province ORDER BY c.created_at DESC))[1] as customer_province,
      -- حساب عدد الطلبات المكتملة لهذا الرقم
      COUNT(DISTINCT o.id) as total_orders,
      -- حساب إجمالي المبلغ المُنفق
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      -- أول تاريخ طلب
      MIN(o.created_at) as first_order_date,
      -- آخر تاريخ طلب
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id 
      AND o.status IN ('completed', 'delivered') 
      AND o.receipt_received = true
    WHERE c.phone IS NOT NULL 
      AND c.phone != ''
      AND regexp_replace(regexp_replace(regexp_replace(
        COALESCE(c.phone, ''), 
        '[\s\-\(\)]', '', 'g'
      ), '^(\+964|00964)', '', 'g'), '^0', '', 'g') != ''
    GROUP BY normalized_phone, c.phone
    HAVING COUNT(DISTINCT o.id) > 0
  LOOP
    normalized_phone := customer_record.normalized_phone;
    
    -- حساب النقاط: 250 نقطة لكل طلب مكتمل
    total_points := customer_record.total_orders * public.calculate_loyalty_points_per_order();
    
    -- العثور على المستوى المناسب
    SELECT id INTO tier_id
    FROM public.loyalty_tiers
    WHERE points_required <= total_points
    ORDER BY points_required DESC
    LIMIT 1;
    
    -- إدراج السجل
    INSERT INTO public.customer_phone_loyalty (
      phone_number,
      original_phone,
      customer_name,
      customer_city,
      customer_province,
      total_points,
      total_spent,
      total_orders,
      current_tier_id,
      first_order_date,
      last_order_date,
      points_expiry_date
    ) VALUES (
      normalized_phone,
      customer_record.original_phone,
      customer_record.customer_name,
      customer_record.customer_city,
      customer_record.customer_province,
      total_points,
      customer_record.total_spent,
      customer_record.total_orders,
      tier_id,
      customer_record.first_order_date,
      customer_record.last_order_date,
      customer_record.last_order_date + INTERVAL '3 months'
    ) RETURNING id INTO loyalty_id;
    
  END LOOP;
  
  RETURN 'تم ترحيل ' || (SELECT COUNT(*) FROM public.customer_phone_loyalty) || ' عميل بنجاح';
END;
$function$;