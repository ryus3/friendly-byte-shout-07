-- تحديث دالة الترحيل لتجميع البيانات بشكل صحيح وتجنب التكرار
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
  
  -- الحصول على العملاء مجمعين حسب رقم الهاتف المطبع (موحد وبدون تكرار)
  FOR customer_record IN
    SELECT 
      normalize_phone_number(c.phone) as normalized_phone,
      -- أخذ أول رقم هاتف أصلي لهذا الرقم المطبع
      (array_agg(c.phone ORDER BY c.created_at ASC))[1] as original_phone,
      -- أخذ آخر اسم عميل لهذا الرقم (أحدث عميل)
      (array_agg(c.name ORDER BY c.created_at DESC))[1] as customer_name,
      -- أخذ آخر مدينة لهذا الرقم
      (array_agg(c.city ORDER BY c.created_at DESC))[1] as customer_city,
      (array_agg(c.province ORDER BY c.created_at DESC))[1] as customer_province,
      -- حساب عدد الطلبات المكتملة لهذا الرقم (جميع العملاء بنفس الرقم)
      COUNT(DISTINCT o.id) as total_orders,
      -- حساب إجمالي المبلغ المُنفق لجميع العملاء بنفس الرقم
      COALESCE(SUM(o.total_amount), 0) as total_spent,
      -- أول تاريخ طلب من أي عميل بهذا الرقم
      MIN(o.created_at) as first_order_date,
      -- آخر تاريخ طلب من أي عميل بهذا الرقم
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id 
      AND o.status IN ('completed', 'delivered') 
      AND o.receipt_received = true
    WHERE c.phone IS NOT NULL 
      AND c.phone != ''
      AND normalize_phone_number(c.phone) != 'غير محدد'
      AND normalize_phone_number(c.phone) != ''
    GROUP BY normalize_phone_number(c.phone)
    HAVING COUNT(DISTINCT o.id) > 0  -- فقط العملاء الذين لديهم طلبات مكتملة
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
    
    -- إدراج السجل الموحد
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
  
  RETURN 'تم ترحيل ' || (SELECT COUNT(*) FROM public.customer_phone_loyalty) || ' عميل بنجاح مع توحيد الأرقام المتشابهة';
END;
$function$;

-- تشغيل دالة الترحيل المحدثة
SELECT public.migrate_existing_customers_to_phone_loyalty();