-- تحديث دالة حساب نقاط الولاء لتكون 200 نقطة لكل طلب بدلاً من السعر
CREATE OR REPLACE FUNCTION public.calculate_loyalty_points_per_order()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 200 نقطة لكل طلب مكتمل
  RETURN 200;
END;
$function$;

-- تحديث دالة إضافة النقاط عند إكمال الطلب
CREATE OR REPLACE FUNCTION public.add_loyalty_points_on_order_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  points_to_add INTEGER;
  order_subtotal NUMERIC;
BEGIN
  -- فقط عند استلام الفاتورة
  IF NEW.receipt_received = true AND (OLD.receipt_received = false OR OLD.receipt_received IS NULL) THEN
    
    -- حساب المبلغ الفرعي (بدون التوصيل)
    order_subtotal := NEW.final_amount - NEW.delivery_fee;
    
    -- التحقق من الحد الأدنى للمبلغ (20000 بدون التوصيل)
    IF order_subtotal >= 20000 THEN
      points_to_add := public.calculate_loyalty_points_per_order();
      
      -- التأكد من وجود العميل في جدول الولاء
      INSERT INTO public.customer_loyalty (customer_id, total_points, total_spent, total_orders)
      VALUES (NEW.customer_id, 0, 0, 0)
      ON CONFLICT (customer_id) DO NOTHING;
      
      -- تحديث نقاط وإحصائيات العميل
      UPDATE public.customer_loyalty 
      SET total_points = total_points + points_to_add,
          total_spent = total_spent + NEW.final_amount,
          total_orders = total_orders + 1,
          updated_at = now()
      WHERE customer_id = NEW.customer_id;
      
      -- إضافة سجل النقاط
      INSERT INTO public.loyalty_points_history (
        customer_id,
        order_id,
        points_earned,
        transaction_type,
        description
      ) VALUES (
        NEW.customer_id,
        NEW.id,
        points_to_add,
        'earned',
        'نقاط من طلب رقم ' || NEW.order_number || ' (200 نقطة)'
      );
      
      -- تحديث مستوى العميل
      PERFORM public.update_customer_tier(NEW.customer_id);
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- دالة للتحقق من أهلية الخصم الشهري (محدثة)
CREATE OR REPLACE FUNCTION public.check_monthly_loyalty_discount_eligibility(p_customer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_tier RECORD;
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
  already_used BOOLEAN;
  discount_percentage NUMERIC := 0;
  customer_points INTEGER := 0;
BEGIN
  -- الحصول على مستوى العميل الحالي
  SELECT lt.discount_percentage, lt.name, cl.total_points
  INTO customer_tier
  FROM public.customer_loyalty cl
  JOIN public.loyalty_tiers lt ON cl.current_tier_id = lt.id
  WHERE cl.customer_id = p_customer_id;
  
  -- التحقق من عدم استخدام الخصم هذا الشهر
  SELECT EXISTS(
    SELECT 1 FROM public.monthly_discount_usage 
    WHERE customer_id = p_customer_id 
    AND discount_month = current_month 
    AND discount_year = current_year
    AND discount_type = 'loyalty'
  ) INTO already_used;
  
  -- إذا لم يستخدم الخصم ولديه مستوى ولاء
  IF NOT already_used AND customer_tier.discount_percentage > 0 THEN
    discount_percentage := customer_tier.discount_percentage;
  END IF;
  
  RETURN jsonb_build_object(
    'eligible', discount_percentage > 0,
    'discount_percentage', discount_percentage,
    'tier_name', customer_tier.name,
    'customer_points', COALESCE(customer_tier.total_points, 0),
    'already_used_this_month', already_used
  );
END;
$function$;

-- دالة لتطبيق الخصم تلقائياً في الطلب السريع
CREATE OR REPLACE FUNCTION public.get_customer_auto_discount(p_customer_phone text, p_customer_city text, p_order_subtotal numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_record RECORD;
  loyalty_discount jsonb;
  city_discount jsonb;
  best_discount jsonb;
  discount_amount numeric := 0;
  discount_type text := '';
  discount_description text := '';
BEGIN
  -- البحث عن العميل
  SELECT id INTO customer_record FROM public.customers 
  WHERE phone = p_customer_phone LIMIT 1;
  
  IF customer_record.id IS NOT NULL THEN
    -- فحص خصم الولاء
    SELECT public.check_monthly_loyalty_discount_eligibility(customer_record.id) INTO loyalty_discount;
    
    -- فحص خصم المدينة
    SELECT public.check_city_random_discount(p_customer_city) INTO city_discount;
    
    -- اختيار أفضل خصم
    IF (loyalty_discount->>'eligible')::boolean AND (loyalty_discount->>'discount_percentage')::numeric > 0 THEN
      IF (city_discount->>'eligible')::boolean AND (city_discount->>'discount_percentage')::numeric > (loyalty_discount->>'discount_percentage')::numeric THEN
        discount_amount := p_order_subtotal * ((city_discount->>'discount_percentage')::numeric / 100);
        discount_type := 'city';
        discount_description := city_discount->>'message';
      ELSE
        discount_amount := p_order_subtotal * ((loyalty_discount->>'discount_percentage')::numeric / 100);
        discount_type := 'loyalty';
        discount_description := 'خصم مستوى الولاء: ' || (loyalty_discount->>'tier_name');
      END IF;
    ELSIF (city_discount->>'eligible')::boolean AND (city_discount->>'discount_percentage')::numeric > 0 THEN
      discount_amount := p_order_subtotal * ((city_discount->>'discount_percentage')::numeric / 100);
      discount_type := 'city';
      discount_description := city_discount->>'message';
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'has_discount', discount_amount > 0,
    'discount_amount', discount_amount,
    'discount_type', discount_type,
    'discount_description', discount_description,
    'customer_id', customer_record.id,
    'loyalty_info', loyalty_discount,
    'city_info', city_discount
  );
END;
$function$;

-- تفعيل تريجر إحصائيات المدن
DROP TRIGGER IF EXISTS update_city_stats_trigger ON orders;
CREATE TRIGGER update_city_stats_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_city_stats_on_order();

-- جدول لتتبع الخصومات المطبقة على العملاء
CREATE TABLE IF NOT EXISTS public.applied_customer_discounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES customers(id),
  order_id uuid REFERENCES orders(id),
  discount_type text NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percentage numeric NOT NULL DEFAULT 0,
  applied_at timestamp with time zone DEFAULT now(),
  applied_by uuid REFERENCES profiles(user_id),
  notes text
);

-- RLS للجدول الجديد
ALTER TABLE public.applied_customer_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يديرون الخصومات المطبقة" ON public.applied_customer_discounts
FOR ALL USING (auth.uid() IS NOT NULL);

-- إضافة فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_applied_discounts_customer_date ON applied_customer_discounts(customer_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_applied_discounts_order ON applied_customer_discounts(order_id);