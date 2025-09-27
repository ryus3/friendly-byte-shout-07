-- إنشاء جدول مرادفات المدن
CREATE TABLE IF NOT EXISTS public.city_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id INTEGER NOT NULL,
  alias_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء جدول مرادفات المناطق  
CREATE TABLE IF NOT EXISTS public.region_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id INTEGER NOT NULL,
  city_id INTEGER NOT NULL,
  alias_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_city_aliases_normalized ON public.city_aliases(normalized_name);
CREATE INDEX IF NOT EXISTS idx_city_aliases_city_id ON public.city_aliases(city_id);
CREATE INDEX IF NOT EXISTS idx_region_aliases_normalized ON public.region_aliases(normalized_name);
CREATE INDEX IF NOT EXISTS idx_region_aliases_city_id ON public.region_aliases(city_id);
CREATE INDEX IF NOT EXISTS idx_region_aliases_region_id ON public.region_aliases(region_id);

-- تفعيل RLS
ALTER TABLE public.city_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_aliases ENABLE ROW LEVEL SECURITY;

-- سياسات الحماية
CREATE POLICY "المستخدمون يرون مرادفات المدن" ON public.city_aliases
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "المديرون يديرون مرادفات المدن" ON public.city_aliases
  FOR ALL USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

CREATE POLICY "المستخدمون يرون مرادفات المناطق" ON public.region_aliases
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "المديرون يديرون مرادفات المناطق" ON public.region_aliases
  FOR ALL USING (is_admin_or_deputy())
  WITH CHECK (is_admin_or_deputy());

-- دالة تطبيع الأسماء العربية
CREATE OR REPLACE FUNCTION public.normalize_arabic_location(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF input_text IS NULL OR trim(input_text) = '' THEN
    RETURN '';
  END IF;
  
  RETURN lower(
    trim(
      -- إزالة "ال" التعريف من البداية
      regexp_replace(
        -- إزالة علامات الترقيم والأرقام
        regexp_replace(
          -- تطبيع المسافات
          regexp_replace(input_text, '\s+', ' ', 'g'),
          '[^\u0600-\u06FF\s]', '', 'g'
        ),
        '^(ال|الـ)\s*', '', 'i'
      )
    )
  );
END;
$$;

-- دالة البحث الذكي للمدن
CREATE OR REPLACE FUNCTION public.smart_search_city(search_term TEXT)
RETURNS TABLE(
  city_id INTEGER,
  city_name TEXT,
  match_type TEXT,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  normalized_search TEXT;
BEGIN
  -- تطبيع مصطلح البحث
  normalized_search := normalize_arabic_location(search_term);
  
  IF normalized_search = '' THEN
    RETURN;
  END IF;

  -- البحث المباشر في المرادفات
  RETURN QUERY
  SELECT 
    ca.city_id,
    c.name,
    'exact_alias'::TEXT as match_type,
    ca.confidence_score
  FROM public.city_aliases ca
  JOIN public.cities_cache c ON ca.city_id = c.id
  WHERE ca.normalized_name = normalized_search
    AND c.is_active = true
  ORDER BY ca.confidence_score DESC;

  -- إذا لم نجد نتائج مباشرة، نبحث في أسماء المدن الأصلية
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      'exact_city'::TEXT as match_type,
      1.0::NUMERIC
    FROM public.cities_cache c
    WHERE normalize_arabic_location(c.name) = normalized_search
      AND c.is_active = true;
  END IF;

  -- البحث التقريبي (يحتوي على)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      ca.city_id,
      c.name,
      'partial_alias'::TEXT as match_type,
      ca.confidence_score * 0.8
    FROM public.city_aliases ca
    JOIN public.cities_cache c ON ca.city_id = c.id
    WHERE ca.normalized_name LIKE '%' || normalized_search || '%'
      AND c.is_active = true
    ORDER BY ca.confidence_score DESC
    LIMIT 5;
  END IF;

  -- البحث في أسماء المدن (يحتوي على)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      c.id,
      c.name,
      'partial_city'::TEXT as match_type,
      0.7::NUMERIC
    FROM public.cities_cache c
    WHERE normalize_arabic_location(c.name) LIKE '%' || normalized_search || '%'
      AND c.is_active = true
    LIMIT 5;
  END IF;
END;
$$;

-- دالة البحث الذكي للمناطق
CREATE OR REPLACE FUNCTION public.smart_search_region(search_term TEXT, target_city_id INTEGER DEFAULT NULL)
RETURNS TABLE(
  region_id INTEGER,
  region_name TEXT,
  city_id INTEGER,
  city_name TEXT,
  match_type TEXT,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  normalized_search TEXT;
BEGIN
  normalized_search := normalize_arabic_location(search_term);
  
  IF normalized_search = '' THEN
    RETURN;
  END IF;

  -- البحث المباشر في المرادفات (مع تفضيل المدينة المحددة)
  RETURN QUERY
  SELECT 
    ra.region_id,
    r.name,
    ra.city_id,
    c.name,
    'exact_alias'::TEXT as match_type,
    CASE 
      WHEN target_city_id IS NOT NULL AND ra.city_id = target_city_id THEN ra.confidence_score * 1.2
      ELSE ra.confidence_score
    END
  FROM public.region_aliases ra
  JOIN public.regions_cache r ON ra.region_id = r.id
  JOIN public.cities_cache c ON ra.city_id = c.id
  WHERE ra.normalized_name = normalized_search
    AND r.is_active = true
    AND c.is_active = true
    AND (target_city_id IS NULL OR ra.city_id = target_city_id)
  ORDER BY 
    CASE WHEN target_city_id IS NOT NULL AND ra.city_id = target_city_id THEN 0 ELSE 1 END,
    ra.confidence_score DESC;

  -- البحث في أسماء المناطق الأصلية
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      r.id,
      r.name,
      r.city_id,
      c.name,
      'exact_region'::TEXT as match_type,
      CASE 
        WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN 1.2
        ELSE 1.0
      END::NUMERIC
    FROM public.regions_cache r
    JOIN public.cities_cache c ON r.city_id = c.id
    WHERE normalize_arabic_location(r.name) = normalized_search
      AND r.is_active = true
      AND c.is_active = true
      AND (target_city_id IS NULL OR r.city_id = target_city_id)
    ORDER BY 
      CASE WHEN target_city_id IS NOT NULL AND r.city_id = target_city_id THEN 0 ELSE 1 END;
  END IF;

  -- البحث التقريبي
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      ra.region_id,
      r.name,
      ra.city_id,
      c.name,
      'partial_alias'::TEXT as match_type,
      CASE 
        WHEN target_city_id IS NOT NULL AND ra.city_id = target_city_id THEN ra.confidence_score * 0.9
        ELSE ra.confidence_score * 0.7
      END
    FROM public.region_aliases ra
    JOIN public.regions_cache r ON ra.region_id = r.id
    JOIN public.cities_cache c ON ra.city_id = c.id
    WHERE ra.normalized_name LIKE '%' || normalized_search || '%'
      AND r.is_active = true
      AND c.is_active = true
      AND (target_city_id IS NULL OR ra.city_id = target_city_id)
    ORDER BY 
      CASE WHEN target_city_id IS NOT NULL AND ra.city_id = target_city_id THEN 0 ELSE 1 END,
      ra.confidence_score DESC
    LIMIT 10;
  END IF;
END;
$$;

-- إدراج مرادفات المدن الأساسية
INSERT INTO public.city_aliases (city_id, alias_name, normalized_name, confidence_score)
SELECT 
  c.id,
  alias.name,
  normalize_arabic_location(alias.name),
  alias.score
FROM public.cities_cache c
CROSS JOIN (
  VALUES 
    ('بغداد', 'بغداد', 1.0),
    ('بغداد', 'العاصمة', 0.9),
    ('بغداد', 'مدينة السلام', 0.8),
    ('البصرة', 'البصرة', 1.0),
    ('البصرة', 'بصرة', 1.0),
    ('البصرة', 'ام المعارك', 0.8),
    ('نينوى - الموصل', 'الموصل', 1.0),
    ('نينوى - الموصل', 'نينوى', 1.0),
    ('نينوى - الموصل', 'موصل', 1.0),
    ('أربيل - هولير', 'أربيل', 1.0),
    ('أربيل - هولير', 'اربيل', 1.0),
    ('أربيل - هولير', 'هولير', 1.0),
    ('أربيل - هولير', 'هوليرة', 0.9),
    ('السليمانية', 'السليمانية', 1.0),
    ('السليمانية', 'سليمانية', 1.0),
    ('دهوك', 'دهوك', 1.0),
    ('دهوك', 'دهك', 0.9),
    ('كركوك', 'كركوك', 1.0),
    ('الأنبار - الرمادي', 'الأنبار', 1.0),
    ('الأنبار - الرمادي', 'الانبار', 1.0),
    ('الأنبار - الرمادي', 'الرمادي', 1.0),
    ('الأنبار - الرمادي', 'رمادي', 1.0),
    ('صلاح الدين - تكريت', 'صلاح الدين', 1.0),
    ('صلاح الدين - تكريت', 'تكريت', 1.0),
    ('صلاح الدين - تكريت', 'صلاح', 0.8),
    ('ديالى - بعقوبة', 'ديالى', 1.0),
    ('ديالى - بعقوبة', 'ديالا', 0.9),
    ('ديالى - بعقوبة', 'بعقوبة', 1.0),
    ('ديالى - بعقوبة', 'بعقوبه', 0.9),
    ('واسط - الكوت', 'واسط', 1.0),
    ('واسط - الكوت', 'الكوت', 1.0),
    ('واسط - الكوت', 'كوت', 1.0),
    ('بابل - الحلة', 'بابل', 1.0),
    ('بابل - الحلة', 'الحلة', 1.0),
    ('بابل - الحلة', 'حلة', 1.0),
    ('كربلاء', 'كربلاء', 1.0),
    ('كربلاء', 'كربلا', 0.9),
    ('النجف', 'النجف', 1.0),
    ('النجف', 'نجف', 1.0),
    ('الديوانية - القادسية', 'الديوانية', 1.0),
    ('الديوانية - القادسية', 'ديوانية', 1.0),
    ('الديوانية - القادسية', 'ديوانيه', 1.0),
    ('الديوانية - القادسية', 'القادسية', 1.0),
    ('الديوانية - القادسية', 'قادسية', 1.0),
    ('المثنى - السماوة', 'المثنى', 1.0),
    ('المثنى - السماوة', 'مثنى', 1.0),
    ('المثنى - السماوة', 'السماوة', 1.0),
    ('المثنى - السماوة', 'سماوة', 1.0),
    ('ذي قار - الناصرية', 'ذي قار', 1.0),
    ('ذي قار - الناصرية', 'ذيقار', 1.0),
    ('ذي قار - الناصرية', 'الناصرية', 1.0),
    ('ذي قار - الناصرية', 'ناصرية', 1.0),
    ('ميسان - العمارة', 'ميسان', 1.0),
    ('ميسان - العمارة', 'العمارة', 1.0),
    ('ميسان - العمارة', 'عمارة', 1.0)
) AS alias(city_name, name, score)
WHERE c.name = alias.city_name
ON CONFLICT DO NOTHING;

-- إدراج مرادفات للمناطق الشائعة (عينة)
WITH popular_regions AS (
  SELECT id, city_id, name,
    CASE 
      WHEN name LIKE '%الجامعة%' THEN ARRAY['جامعة', 'حي الجامعة', 'منطقة الجامعة']
      WHEN name LIKE '%الصحة%' THEN ARRAY['صحة', 'دورة الصحة', 'شارع الصحة']
      WHEN name LIKE '%الكرادة%' THEN ARRAY['كرادة', 'الكراده']
      WHEN name LIKE '%الجادرية%' THEN ARRAY['جادرية', 'الجادريه']
      WHEN name LIKE '%الأعظمية%' THEN ARRAY['الاعظمية', 'اعظمية']
      WHEN name LIKE '%الكاظمية%' THEN ARRAY['الكاظميه', 'كاظمية']
      WHEN name LIKE '%المنصور%' THEN ARRAY['منصور']
      WHEN name LIKE '%الحرية%' THEN ARRAY['حرية']
      ELSE ARRAY[]::TEXT[]
    END as aliases
  FROM regions_cache
  WHERE is_active = true
)
INSERT INTO public.region_aliases (region_id, city_id, alias_name, normalized_name, confidence_score)
SELECT 
  pr.id,
  pr.city_id,
  unnest(pr.aliases),
  normalize_arabic_location(unnest(pr.aliases)),
  0.9
FROM popular_regions pr
WHERE array_length(pr.aliases, 1) > 0
ON CONFLICT DO NOTHING;