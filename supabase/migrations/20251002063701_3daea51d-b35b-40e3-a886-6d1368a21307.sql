-- إضافة حقول معالجة العناوين الذكية لجدول ai_orders
ALTER TABLE public.ai_orders
ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES public.cities_cache(id),
ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES public.regions_cache(id),
ADD COLUMN IF NOT EXISTS resolved_city_name TEXT,
ADD COLUMN IF NOT EXISTS resolved_region_name TEXT,
ADD COLUMN IF NOT EXISTS location_confidence NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS location_suggestions JSONB DEFAULT '[]'::jsonb;

-- إنشاء فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_ai_orders_city_id ON public.ai_orders(city_id);
CREATE INDEX IF NOT EXISTS idx_ai_orders_region_id ON public.ai_orders(region_id);

COMMENT ON COLUMN public.ai_orders.city_id IS 'معرف المدينة المعالج بالذكاء الاصطناعي';
COMMENT ON COLUMN public.ai_orders.region_id IS 'معرف المنطقة المعالج بالذكاء الاصطناعي';
COMMENT ON COLUMN public.ai_orders.resolved_city_name IS 'اسم المدينة المعالج';
COMMENT ON COLUMN public.ai_orders.resolved_region_name IS 'اسم المنطقة المعالج';
COMMENT ON COLUMN public.ai_orders.location_confidence IS 'درجة الثقة في معالجة الموقع (0-1)';
COMMENT ON COLUMN public.ai_orders.location_suggestions IS 'اقتراحات بديلة للموقع';