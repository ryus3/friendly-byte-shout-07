-- إنشاء نظام ولاء جديد مبني على رقم الهاتف
-- 1. إنشاء جدول ولاء العملاء الموحد حسب رقم الهاتف
CREATE TABLE IF NOT EXISTS public.customer_phone_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE, -- رقم الهاتف المطبع
  original_phone TEXT, -- رقم الهاتف الأصلي
  customer_name TEXT, -- اسم العميل (آخر اسم مسجل)
  customer_city TEXT, -- مدينة العميل (آخر مدينة)
  customer_province TEXT, -- محافظة العميل (آخر محافظة)
  total_points INTEGER DEFAULT 0,
  current_tier_id UUID REFERENCES public.loyalty_tiers(id),
  total_spent NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  first_order_date TIMESTAMP WITH TIME ZONE,
  last_order_date TIMESTAMP WITH TIME ZONE,
  last_tier_upgrade TIMESTAMP WITH TIME ZONE,
  points_expiry_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- فهرس لتسريع البحث
CREATE INDEX idx_customer_phone_loyalty_phone ON public.customer_phone_loyalty(phone_number);

-- تفعيل RLS
ALTER TABLE public.customer_phone_loyalty ENABLE ROW LEVEL SECURITY;

-- سياسة الأمان - المستخدمون يرون عملاءهم فقط
CREATE POLICY "المستخدمون يديرون ولاء عملائهم حسب الهاتف" 
ON public.customer_phone_loyalty 
FOR ALL 
USING (
  phone_number IN (
    SELECT REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(COALESCE(c.phone, ''), '[\s\-\(\)]', '', 'g'),
        '^(\+964|00964)', '', 'g'
      ),
      '^0', '', 'g'
    )
    FROM public.customers c 
    WHERE c.created_by = auth.uid()
  )
)
WITH CHECK (
  phone_number IN (
    SELECT REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(COALESCE(c.phone, ''), '[\s\-\(\)]', '', 'g'),
        '^(\+964|00964)', '', 'g'
      ),
      '^0', '', 'g'
    )
    FROM public.customers c 
    WHERE c.created_by = auth.uid()
  )
);

-- 2. دالة تطبيع رقم الهاتف
CREATE OR REPLACE FUNCTION public.normalize_phone_number(phone_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF phone_input IS NULL OR TRIM(phone_input) = '' THEN
    RETURN 'غير محدد';
  END IF;
  
  -- إزالة المسافات والرموز
  phone_input := REGEXP_REPLACE(phone_input, '[\s\-\(\)]', '', 'g');
  -- إزالة كود العراق
  phone_input := REGEXP_REPLACE(phone_input, '^(\+964|00964)', '', 'g');
  -- إزالة الصفر الأول
  phone_input := REGEXP_REPLACE(phone_input, '^0', '', 'g');
  
  RETURN phone_input;
END;
$$;

-- 3. دالة تحديث نقاط العميل حسب رقم الهاتف
CREATE OR REPLACE FUNCTION public.update_customer_phone_loyalty(
  p_phone TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_city TEXT DEFAULT NULL,
  p_customer_province TEXT DEFAULT NULL,
  p_order_amount NUMERIC DEFAULT 0,
  p_order_date TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  normalized_phone TEXT;
  loyalty_record RECORD;
  points_to_add INTEGER;
  new_tier_id UUID;
  loyalty_id UUID;
BEGIN
  -- تطبيع رقم الهاتف
  normalized_phone := normalize_phone_number(p_phone);
  
  -- حساب النقاط (1 نقطة لكل 1000 دينار)
  points_to_add := FLOOR(p_order_amount / 1000);
  
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
$$;