-- إنشاء جدول التعلم من الأخطاء للذكاء الاصطناعي
CREATE TABLE IF NOT EXISTS public.ai_learning_corrections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_text text NOT NULL,
  corrected_city text NOT NULL,
  corrected_region text,
  confidence_score numeric DEFAULT 1.0,
  usage_count integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- إضافة فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_ai_learning_original_text ON public.ai_learning_corrections (original_text);

-- جدول cache للمناطق إذا لم يكن موجود
CREATE TABLE IF NOT EXISTS public.regions_cache (
  id serial PRIMARY KEY,
  alwaseet_id integer NOT NULL,
  name text NOT NULL,
  name_ar text,
  name_en text,
  city_id integer NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- إضافة فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_regions_cache_city_id ON public.regions_cache (city_id);
CREATE INDEX IF NOT EXISTS idx_regions_cache_name ON public.regions_cache (name);

-- RLS للجداول الجديدة
ALTER TABLE public.ai_learning_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المستخدمون يرون تصحيحات الذكاء الاصطناعي" ON public.ai_learning_corrections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "النظام يدير تصحيحات الذكاء الاصطناعي" ON public.ai_learning_corrections FOR ALL USING (true);

CREATE POLICY "المستخدمون يرون cache المناطق" ON public.regions_cache FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "المديرون يديرون cache المناطق" ON public.regions_cache FOR ALL USING (is_admin_or_deputy());