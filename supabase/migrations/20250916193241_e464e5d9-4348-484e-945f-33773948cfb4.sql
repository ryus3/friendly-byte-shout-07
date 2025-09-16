-- إنشاء جداول cache للمدن والمناطق من شركة التوصيل
CREATE TABLE IF NOT EXISTS public.cities_cache (
  id SERIAL PRIMARY KEY,
  alwaseet_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  name_en TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.regions_cache (
  id SERIAL PRIMARY KEY,
  alwaseet_id INTEGER NOT NULL UNIQUE,
  city_id INTEGER NOT NULL REFERENCES public.cities_cache(alwaseet_id),
  name TEXT NOT NULL,
  name_ar TEXT,
  name_en TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إضافة الفهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_cities_cache_name ON public.cities_cache (name);
CREATE INDEX IF NOT EXISTS idx_cities_cache_alwaseet_id ON public.cities_cache (alwaseet_id);
CREATE INDEX IF NOT EXISTS idx_regions_cache_name ON public.regions_cache (name);
CREATE INDEX IF NOT EXISTS idx_regions_cache_city_id ON public.regions_cache (city_id);
CREATE INDEX IF NOT EXISTS idx_regions_cache_alwaseet_id ON public.regions_cache (alwaseet_id);

-- إضافة RLS
ALTER TABLE public.cities_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions_cache ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان
CREATE POLICY "المستخدمون يرون cache المدن" ON public.cities_cache FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "المديرون يديرون cache المدن" ON public.cities_cache FOR ALL USING (is_admin_or_deputy());
CREATE POLICY "المستخدمون يرون cache المناطق" ON public.regions_cache FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "المديرون يديرون cache المناطق" ON public.regions_cache FOR ALL USING (is_admin_or_deputy());

-- إضافة city_id و region_id لجدول ai_orders
ALTER TABLE public.ai_orders 
ADD COLUMN IF NOT EXISTS city_id INTEGER,
ADD COLUMN IF NOT EXISTS region_id INTEGER;

-- تحديث دالة process_telegram_order لدعم city_id و region_id
CREATE OR REPLACE FUNCTION public.process_telegram_order(
  p_order_data jsonb, 
  p_customer_name text, 
  p_customer_phone text DEFAULT NULL::text, 
  p_customer_address text DEFAULT NULL::text, 
  p_total_amount numeric DEFAULT 0, 
  p_items jsonb DEFAULT '[]'::jsonb, 
  p_telegram_chat_id bigint DEFAULT NULL::bigint, 
  p_employee_code text DEFAULT NULL::text,
  p_city_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_id UUID;
  v_employee_id UUID;
  v_customer_city TEXT;
  v_customer_province TEXT;
BEGIN
  -- العثور على معرف الموظف من الكود
  SELECT user_id INTO v_employee_id
  FROM telegram_employee_codes 
  WHERE employee_code = p_employee_code AND is_active = true
  LIMIT 1;

  -- تحديد المدينة والمقاطعة من cache إذا توفرت
  IF p_city_id IS NOT NULL THEN
    SELECT name INTO v_customer_city 
    FROM cities_cache 
    WHERE alwaseet_id = p_city_id;
  END IF;

  -- إدخال الطلب الجديد
  INSERT INTO public.ai_orders (
    order_data,
    customer_name,
    customer_phone,
    customer_address,
    customer_city,
    customer_province,
    total_amount,
    items,
    telegram_chat_id,
    created_by,
    city_id,
    region_id,
    source,
    status
  ) VALUES (
    p_order_data,
    p_customer_name,
    p_customer_phone,
    p_customer_address,
    COALESCE(v_customer_city, p_customer_address),
    v_customer_province,
    p_total_amount,
    p_items,
    p_telegram_chat_id,
    v_employee_id,
    p_city_id,
    p_region_id,
    'telegram',
    'pending'
  ) RETURNING id INTO order_id;

  RETURN order_id;
END;
$function$;

-- دالة لجلب المدن من cache مع البحث الذكي
CREATE OR REPLACE FUNCTION public.find_city_in_cache(p_city_text TEXT)
RETURNS TABLE(alwaseet_id INTEGER, name TEXT, similarity_score NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    c.alwaseet_id,
    c.name,
    CASE 
      WHEN LOWER(c.name) = LOWER(p_city_text) THEN 1.0
      WHEN LOWER(c.name) LIKE '%' || LOWER(p_city_text) || '%' THEN 0.8
      WHEN LOWER(p_city_text) LIKE '%' || LOWER(c.name) || '%' THEN 0.7
      ELSE 0.0
    END as similarity_score
  FROM cities_cache c
  WHERE c.is_active = true
    AND (
      LOWER(c.name) = LOWER(p_city_text)
      OR LOWER(c.name) LIKE '%' || LOWER(p_city_text) || '%'
      OR LOWER(p_city_text) LIKE '%' || LOWER(c.name) || '%'
    )
  ORDER BY similarity_score DESC, c.name
  LIMIT 5;
END;
$function$;

-- دالة لجلب المناطق من cache مع البحث الذكي
CREATE OR REPLACE FUNCTION public.find_region_in_cache(p_city_id INTEGER, p_region_text TEXT)
RETURNS TABLE(alwaseet_id INTEGER, name TEXT, similarity_score NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r.alwaseet_id,
    r.name,
    CASE 
      WHEN LOWER(r.name) = LOWER(p_region_text) THEN 1.0
      WHEN LOWER(r.name) LIKE '%' || LOWER(p_region_text) || '%' THEN 0.8
      WHEN LOWER(p_region_text) LIKE '%' || LOWER(r.name) || '%' THEN 0.7
      ELSE 0.0
    END as similarity_score
  FROM regions_cache r
  WHERE r.is_active = true
    AND r.city_id = p_city_id
    AND (
      LOWER(r.name) = LOWER(p_region_text)
      OR LOWER(r.name) LIKE '%' || LOWER(p_region_text) || '%'
      OR LOWER(p_region_text) LIKE '%' || LOWER(r.name) || '%'
    )
  ORDER BY similarity_score DESC, r.name
  LIMIT 5;
END;
$function$;