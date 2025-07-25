-- تحديث نقاط مستويات الولاء
UPDATE public.loyalty_tiers 
SET points_required = 750 
WHERE name = 'فضي';

UPDATE public.loyalty_tiers 
SET points_required = 2000 
WHERE name = 'ذهبي';

UPDATE public.loyalty_tiers 
SET points_required = 7000 
WHERE name = 'ماسي';

-- إضافة جدول لتتبع استخدام الخصومات الشهرية
CREATE TABLE public.monthly_discount_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  discount_month INTEGER NOT NULL, -- شهر (1-12)
  discount_year INTEGER NOT NULL, -- سنة
  discount_type TEXT NOT NULL, -- 'loyalty' أو 'city_random'
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id, discount_month, discount_year, discount_type)
);

-- تفعيل RLS على الجدول الجديد
ALTER TABLE public.monthly_discount_usage ENABLE ROW LEVEL SECURITY;

-- إضافة سياسة RLS
CREATE POLICY "المستخدمون يديرون خصومات العملاء الشهرية"
ON public.monthly_discount_usage
FOR ALL
USING (auth.uid() IS NOT NULL);

-- إضافة جدول للخصومات العشوائية للمدن
CREATE TABLE public.city_random_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_name TEXT NOT NULL,
  discount_month INTEGER NOT NULL,
  discount_year INTEGER NOT NULL,
  discount_percentage NUMERIC NOT NULL DEFAULT 5, -- نسبة الخصم
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city_name, discount_month, discount_year)
);

-- تفعيل RLS
ALTER TABLE public.city_random_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يديرون خصومات المدن العشوائية"
ON public.city_random_discounts
FOR ALL
USING (auth.uid() IS NOT NULL);

-- دالة للتحقق من استحقاق الخصم الشهري للولاء
CREATE OR REPLACE FUNCTION public.check_monthly_loyalty_discount_eligibility(p_customer_id UUID)
RETURNS JSONB
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
BEGIN
  -- الحصول على مستوى العميل الحالي
  SELECT lt.discount_percentage, lt.name 
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
    'already_used_this_month', already_used
  );
END;
$function$;

-- دالة للتحقق من خصم المدينة العشوائي
CREATE OR REPLACE FUNCTION public.check_city_random_discount(p_city_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
  city_discount RECORD;
BEGIN
  -- البحث عن خصم المدينة لهذا الشهر
  SELECT discount_percentage 
  INTO city_discount
  FROM public.city_random_discounts 
  WHERE LOWER(city_name) = LOWER(p_city_name)
  AND discount_month = current_month 
  AND discount_year = current_year;
  
  RETURN jsonb_build_object(
    'eligible', city_discount.discount_percentage IS NOT NULL,
    'discount_percentage', COALESCE(city_discount.discount_percentage, 0),
    'message', CASE 
      WHEN city_discount.discount_percentage IS NOT NULL 
      THEN 'تهانينا! مدينتك ' || p_city_name || ' مختارة لخصم خاص هذا الشهر!'
      ELSE NULL
    END
  );
END;
$function$;

-- دالة لتسجيل استخدام الخصم
CREATE OR REPLACE FUNCTION public.record_discount_usage(
  p_customer_id UUID,
  p_discount_type TEXT,
  p_discount_amount NUMERIC,
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month INTEGER := EXTRACT(MONTH FROM now());
  current_year INTEGER := EXTRACT(YEAR FROM now());
BEGIN
  INSERT INTO public.monthly_discount_usage (
    customer_id,
    discount_month,
    discount_year,
    discount_type,
    discount_amount,
    order_id
  ) VALUES (
    p_customer_id,
    current_month,
    current_year,
    p_discount_type,
    p_discount_amount,
    p_order_id
  ) ON CONFLICT (customer_id, discount_month, discount_year, discount_type) DO NOTHING;
END;
$function$;