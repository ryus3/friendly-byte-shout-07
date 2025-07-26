-- إنشاء الجداول المفقودة أولاً

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

-- 2. إضافة جدول تقسيم العملاء حسب الجنس
CREATE TABLE IF NOT EXISTS public.customer_gender_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  gender_type TEXT NOT NULL CHECK (gender_type IN ('male', 'female', 'unisex')),
  confidence_score NUMERIC NOT NULL DEFAULT 1.0,
  last_analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. إضافة جدول تصنيف المنتجات حسب الجنس
CREATE TABLE IF NOT EXISTS public.product_gender_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  product_type_id UUID REFERENCES product_types(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  gender_type TEXT NOT NULL CHECK (gender_type IN ('male', 'female', 'unisex')),
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. تمكين Row Level Security
ALTER TABLE public.customer_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_gender_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_gender_categories ENABLE ROW LEVEL SECURITY;

-- 5. إنشاء السياسات الأمنية
CREATE POLICY "المستخدمون يديرون البروموكود" ON public.customer_promo_codes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "المستخدمون يديرون تقسيم الجنس" ON public.customer_gender_segments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "المستخدمون يديرون تصنيف المنتجات" ON public.product_gender_categories FOR ALL USING (auth.uid() IS NOT NULL);