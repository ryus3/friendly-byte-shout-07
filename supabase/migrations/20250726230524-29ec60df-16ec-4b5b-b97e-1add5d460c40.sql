-- إضافة نظام البروموكود وتقسيم العملاء حسب الجنس

-- 1. إضافة جدول البروموكود
CREATE TABLE IF NOT EXISTS public.customer_promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  promo_code TEXT NOT NULL UNIQUE,
  tier_id UUID REFERENCES loyalty_tiers(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  used_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1,
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. تحديث جدول customer_loyalty لإضافة صلاحية النقاط تلقائياً
ALTER TABLE public.customer_loyalty 
ADD COLUMN IF NOT EXISTS points_expiry_date TIMESTAMP WITH TIME ZONE;

-- 3. إضافة جدول تقسيم العملاء حسب الجنس
CREATE TABLE IF NOT EXISTS public.customer_gender_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  gender_type TEXT NOT NULL CHECK (gender_type IN ('male', 'female', 'unisex')),
  confidence_score NUMERIC NOT NULL DEFAULT 1.0,
  last_analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. إضافة جدول تصنيف المنتجات حسب الجنس
CREATE TABLE IF NOT EXISTS public.product_gender_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  product_type_id UUID REFERENCES product_types(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  gender_type TEXT NOT NULL CHECK (gender_type IN ('male', 'female', 'unisex')),
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. تمكين Row Level Security
ALTER TABLE public.customer_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_gender_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_gender_categories ENABLE ROW LEVEL SECURITY;

-- 6. إنشاء السياسات الأمنية
CREATE POLICY "المستخدمون يديرون البروموكود" ON public.customer_promo_codes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "المستخدمون يديرون تقسيم الجنس" ON public.customer_gender_segments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "المستخدمون يديرون تصنيف المنتجات" ON public.product_gender_categories FOR ALL USING (auth.uid() IS NOT NULL);

-- 7. دالة لإنشاء البروموكود التلقائي
CREATE OR REPLACE FUNCTION public.generate_customer_promo_code(customer_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  customer_phone TEXT;
  tier_name TEXT;
  promo_code TEXT;
BEGIN
  -- جلب بيانات العميل
  SELECT c.phone, COALESCE(lt.name_en, 'NORM') INTO customer_phone, tier_name
  FROM customers c
  LEFT JOIN customer_loyalty cl ON c.id = cl.customer_id
  LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
  WHERE c.id = customer_id_param;
  
  -- إنشاء البروموكود
  IF customer_phone IS NOT NULL THEN
    promo_code := 'RY' || RIGHT(customer_phone, 4) || UPPER(LEFT(tier_name, 2));
  ELSE
    promo_code := 'RY' || UPPER(LEFT(customer_id_param::TEXT, 6));
  END IF;
  
  -- التأكد من عدم التكرار
  WHILE EXISTS (SELECT 1 FROM customer_promo_codes WHERE promo_code = promo_code) LOOP
    promo_code := promo_code || FLOOR(RANDOM() * 10)::TEXT;
  END LOOP;
  
  RETURN promo_code;
END;
$$;

-- 8. دالة لتحليل جنس العميل بناءً على مشترياته
CREATE OR REPLACE FUNCTION public.analyze_customer_gender(customer_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  male_score NUMERIC := 0;
  female_score NUMERIC := 0;
  total_orders INTEGER := 0;
  gender_result TEXT := 'unisex';
BEGIN
  -- حساب النقاط بناءً على المشتريات
  SELECT 
    COUNT(*) as total,
    COALESCE(SUM(CASE WHEN pgc.gender_type = 'male' THEN pgc.priority ELSE 0 END), 0) as male_points,
    COALESCE(SUM(CASE WHEN pgc.gender_type = 'female' THEN pgc.priority ELSE 0 END), 0) as female_points
  INTO total_orders, male_score, female_score
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  JOIN products p ON oi.product_id = p.id
  LEFT JOIN product_categories pc ON p.id = pc.product_id
  LEFT JOIN product_gender_categories pgc ON pc.category_id = pgc.category_id
  WHERE o.customer_id = customer_id_param 
    AND o.status IN ('completed', 'delivered');
  
  -- تحديد الجنس
  IF total_orders > 0 THEN
    IF male_score > female_score * 1.5 THEN
      gender_result := 'male';
    ELSIF female_score > male_score * 1.5 THEN
      gender_result := 'female';
    ELSE
      gender_result := 'unisex';
    END IF;
  END IF;
  
  -- حفظ النتيجة
  INSERT INTO customer_gender_segments (customer_id, gender_type, confidence_score)
  VALUES (customer_id_param, gender_result, GREATEST(male_score, female_score) / (male_score + female_score + 1))
  ON CONFLICT (customer_id) 
  DO UPDATE SET 
    gender_type = EXCLUDED.gender_type,
    confidence_score = EXCLUDED.confidence_score,
    last_analysis_date = now(),
    updated_at = now();
  
  RETURN gender_result;
END;
$$;

-- 9. دالة للتحقق من البروموكود وتطبيق الخصم
CREATE OR REPLACE FUNCTION public.validate_promo_code(promo_code_param TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  promo_record RECORD;
  result JSON;
BEGIN
  -- البحث عن البروموكود
  SELECT cpc.*, c.name as customer_name, lt.discount_percentage, lt.name as tier_name
  INTO promo_record
  FROM customer_promo_codes cpc
  JOIN customers c ON cpc.customer_id = c.id
  LEFT JOIN loyalty_tiers lt ON cpc.tier_id = lt.id
  WHERE cpc.promo_code = promo_code_param 
    AND cpc.is_active = true 
    AND cpc.used_count < cpc.max_uses;
  
  IF promo_record IS NULL THEN
    result := json_build_object(
      'valid', false,
      'message', 'برومو كود غير صالح أو منتهي الصلاحية'
    );
  ELSE
    result := json_build_object(
      'valid', true,
      'customer_id', promo_record.customer_id,
      'customer_name', promo_record.customer_name,
      'discount_percentage', promo_record.discount_percentage,
      'tier_name', promo_record.tier_name,
      'message', 'برومو كود صالح - خصم ' || promo_record.discount_percentage || '%'
    );
  END IF;
  
  RETURN result;
END;
$$;

-- 10. إدراج تصنيفات المنتجات الافتراضية (رجالي/نسائي)
INSERT INTO product_gender_categories (category_id, gender_type, priority)
SELECT id, 'male', 3 FROM categories WHERE name ILIKE '%رجال%' OR name ILIKE '%شباب%'
ON CONFLICT DO NOTHING;

INSERT INTO product_gender_categories (category_id, gender_type, priority)
SELECT id, 'female', 3 FROM categories WHERE name ILIKE '%نساء%' OR name ILIKE '%بنات%' OR name ILIKE '%سيدات%'
ON CONFLICT DO NOTHING;

-- 11. تحديث صلاحية النقاط للعملاء الحاليين
UPDATE customer_loyalty 
SET points_expiry_date = (last_tier_upgrade + INTERVAL '3 months')
WHERE points_expiry_date IS NULL AND last_tier_upgrade IS NOT NULL;

-- 12. إنشاء البروموكود للعملاء الحاليين
INSERT INTO customer_promo_codes (customer_id, promo_code, tier_id, discount_percentage)
SELECT 
  cl.customer_id,
  generate_customer_promo_code(cl.customer_id),
  cl.current_tier_id,
  COALESCE(lt.discount_percentage, 0)
FROM customer_loyalty cl
LEFT JOIN loyalty_tiers lt ON cl.current_tier_id = lt.id
WHERE NOT EXISTS (
  SELECT 1 FROM customer_promo_codes cpc WHERE cpc.customer_id = cl.customer_id
);