-- إضافة جداول جديدة لدعم أكثر من تصنيف/موسم/مناسبة لكل منتج

-- جدول أنواع المنتجات  
CREATE TABLE IF NOT EXISTS public.product_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول المواسم والمناسبات
CREATE TABLE IF NOT EXISTS public.seasons_occasions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'season', -- 'season' أو 'occasion'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول ربط المنتجات بالتصنيفات (علاقة many-to-many)
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  category_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- جدول ربط المنتجات بأنواع المنتجات (علاقة many-to-many)
CREATE TABLE IF NOT EXISTS public.product_product_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  product_type_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, product_type_id)
);

-- جدول ربط المنتجات بالمواسم والمناسبات (علاقة many-to-many)
CREATE TABLE IF NOT EXISTS public.product_seasons_occasions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  season_occasion_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, season_occasion_id)
);

-- جدول ربط المنتجات بالأقسام (علاقة many-to-many)
CREATE TABLE IF NOT EXISTS public.product_departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL,
  department_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, department_id)
);

-- إضافة Foreign Keys
ALTER TABLE public.product_categories 
ADD CONSTRAINT product_categories_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_categories 
ADD CONSTRAINT product_categories_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.product_product_types 
ADD CONSTRAINT product_product_types_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_product_types 
ADD CONSTRAINT product_product_types_product_type_id_fkey 
FOREIGN KEY (product_type_id) REFERENCES public.product_types(id) ON DELETE CASCADE;

ALTER TABLE public.product_seasons_occasions 
ADD CONSTRAINT product_seasons_occasions_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_seasons_occasions 
ADD CONSTRAINT product_seasons_occasions_season_occasion_id_fkey 
FOREIGN KEY (season_occasion_id) REFERENCES public.seasons_occasions(id) ON DELETE CASCADE;

ALTER TABLE public.product_departments 
ADD CONSTRAINT product_departments_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_departments 
ADD CONSTRAINT product_departments_department_id_fkey 
FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;

-- إضافة RLS policies
ALTER TABLE public.product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_seasons_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_departments ENABLE ROW LEVEL SECURITY;

-- Policies للمشاهدة العامة
CREATE POLICY "Anyone can view product_types" ON public.product_types FOR SELECT USING (true);
CREATE POLICY "Anyone can view seasons_occasions" ON public.seasons_occasions FOR SELECT USING (true);
CREATE POLICY "Anyone can view product_categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can view product_product_types" ON public.product_product_types FOR SELECT USING (true);
CREATE POLICY "Anyone can view product_seasons_occasions" ON public.product_seasons_occasions FOR SELECT USING (true);
CREATE POLICY "Anyone can view product_departments" ON public.product_departments FOR SELECT USING (true);

-- Policies للإدارة للمستخدمين المصادقين
CREATE POLICY "Authenticated users can manage product_types" ON public.product_types FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage seasons_occasions" ON public.seasons_occasions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage product_categories" ON public.product_categories FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage product_product_types" ON public.product_product_types FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage product_seasons_occasions" ON public.product_seasons_occasions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage product_departments" ON public.product_departments FOR ALL USING (auth.uid() IS NOT NULL);

-- إضافة بعض البيانات التجريبية
INSERT INTO public.product_types (name, description) VALUES 
('ملابس رجالية', 'ملابس خاصة بالرجال'),
('ملابس نسائية', 'ملابس خاصة بالنساء'),
('ملابس أطفال', 'ملابس خاصة بالأطفال'),
('أحذية', 'جميع أنواع الأحذية'),
('إكسسوارات', 'الإكسسوارات والمجوهرات'),
('حقائب', 'حقائب اليد والحقائب الرياضية'),
('ساعات', 'الساعات بجميع أنواعها'),
('نظارات', 'النظارات الشمسية والطبية'),
('أجهزة إلكترونية', 'الأجهزة الإلكترونية والتقنية'),
('مستحضرات تجميل', 'مستحضرات التجميل والعناية')
ON CONFLICT DO NOTHING;

INSERT INTO public.seasons_occasions (name, type, description) VALUES 
('صيف', 'season', 'منتجات الموسم الصيفي'),
('شتاء', 'season', 'منتجات الموسم الشتوي'),
('ربيع', 'season', 'منتجات موسم الربيع'),
('خريف', 'season', 'منتجات موسم الخريف'),
('عيد الفطر', 'occasion', 'منتجات خاصة بعيد الفطر'),
('عيد الأضحى', 'occasion', 'منتجات خاصة بعيد الأضحى'),
('رمضان', 'occasion', 'منتجات خاصة بشهر رمضان'),
('العودة للمدارس', 'occasion', 'منتجات العودة للمدارس'),
('الزفاف', 'occasion', 'منتجات الزفاف'),
('السنة الجديدة', 'occasion', 'منتجات احتفالات السنة الجديدة'),
('عيد الحب', 'occasion', 'منتجات عيد الحب'),
('عيد الأم', 'occasion', 'منتجات عيد الأم')
ON CONFLICT DO NOTHING;

-- إضافة trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_types_updated_at
  BEFORE UPDATE ON public.product_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seasons_occasions_updated_at
  BEFORE UPDATE ON public.seasons_occasions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- إضافة عمود للاسم الافتراضي للزبون في جدول profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_customer_name TEXT;