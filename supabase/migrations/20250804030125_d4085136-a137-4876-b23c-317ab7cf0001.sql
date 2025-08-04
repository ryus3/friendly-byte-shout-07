-- إصلاح نظام مستويات الولاء للعملاء المدمجين حسب الهاتف

-- إنشاء دالة لتحديث مستوى العميل بناءً على النقاط
CREATE OR REPLACE FUNCTION update_customer_tier_by_phone(phone_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_points INTEGER;
  new_tier_id UUID;
  old_tier_id UUID;
  new_tier_name TEXT;
  customer_name_var TEXT;
BEGIN
  -- الحصول على نقاط العميل الحالية
  SELECT cpl.total_points, cpl.current_tier_id, cpl.customer_name 
  INTO customer_points, old_tier_id, customer_name_var
  FROM public.customer_phone_loyalty cpl
  WHERE cpl.phone_number = phone_param;
  
  -- إذا لم يوجد العميل، اخرج من الدالة
  IF customer_points IS NULL THEN
    RETURN;
  END IF;
  
  -- العثور على المستوى المناسب
  SELECT lt.id, lt.name INTO new_tier_id, new_tier_name
  FROM public.loyalty_tiers lt
  WHERE lt.points_required <= customer_points
  ORDER BY lt.points_required DESC
  LIMIT 1;
  
  -- تحديث المستوى إذا تغير أو كان فارغاً
  IF new_tier_id != old_tier_id OR old_tier_id IS NULL THEN
    UPDATE public.customer_phone_loyalty 
    SET current_tier_id = new_tier_id,
        last_tier_upgrade = now(),
        updated_at = now()
    WHERE phone_number = phone_param;
    
    -- إضافة إشعار للترقية إذا كان هناك اسم للعميل
    IF customer_name_var IS NOT NULL AND customer_name_var != '' THEN
      INSERT INTO public.notifications (
        title,
        message,
        type,
        data,
        user_id
      ) VALUES (
        'ترقية مستوى العميل',
        'تم ترقية العميل ' || customer_name_var || ' إلى مستوى ' || COALESCE(new_tier_name, 'غير محدد'),
        'loyalty_upgrade',
        jsonb_build_object(
          'phone_number', phone_param, 
          'new_tier_id', new_tier_id, 
          'new_tier_name', new_tier_name,
          'customer_name', customer_name_var
        ),
        NULL
      );
    END IF;
  END IF;
END;
$$;

-- تحديث جميع العملاء الموجودين لضمان وجود مستويات صحيحة
DO $$
DECLARE
  customer_record RECORD;
BEGIN
  FOR customer_record IN 
    SELECT phone_number FROM public.customer_phone_loyalty 
    WHERE total_points > 0
  LOOP
    PERFORM update_customer_tier_by_phone(customer_record.phone_number);
  END LOOP;
END $$;

-- إنشاء trigger لتحديث المستوى تلقائياً عند تغيير النقاط
CREATE OR REPLACE FUNCTION auto_update_phone_customer_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- تحديث المستوى إذا تغيرت النقاط
  IF NEW.total_points != OLD.total_points THEN
    PERFORM update_customer_tier_by_phone(NEW.phone_number);
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف trigger القديم إن وجد
DROP TRIGGER IF EXISTS update_phone_customer_tier_trigger ON public.customer_phone_loyalty;

-- إنشاء trigger جديد
CREATE TRIGGER update_phone_customer_tier_trigger
  AFTER UPDATE ON public.customer_phone_loyalty
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_phone_customer_tier();

-- إصلاح إحصائيات المدن
CREATE OR REPLACE FUNCTION update_city_order_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
  -- حذف الإحصائيات القديمة للشهر الحالي
  DELETE FROM public.city_order_stats 
  WHERE month = current_month AND year = current_year;
  
  -- إدراج إحصائيات جديدة للشهر الحالي
  INSERT INTO public.city_order_stats (city_name, month, year, total_orders, total_amount)
  SELECT 
    COALESCE(o.customer_city, 'غير محدد') as city_name,
    current_month,
    current_year,
    COUNT(o.id)::integer as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_amount
  FROM public.orders o
  WHERE EXTRACT(MONTH FROM o.created_at) = current_month
    AND EXTRACT(YEAR FROM o.created_at) = current_year
    AND o.status IN ('completed', 'delivered')
    AND o.receipt_received = true
  GROUP BY o.customer_city;
  
  RAISE NOTICE 'تم تحديث إحصائيات المدن للشهر الحالي';
END;
$$;

-- تشغيل تحديث إحصائيات المدن
SELECT update_city_order_stats();