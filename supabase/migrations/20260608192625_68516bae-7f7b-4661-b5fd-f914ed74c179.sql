
-- 1) جدول الصفحات الثابتة للمتجر (سياسات، إرجاع، شروط، من نحن، اتصل)
CREATE TABLE IF NOT EXISTS public.storefront_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  page_type text NOT NULL CHECK (page_type IN ('privacy','returns','terms','about','contact')),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT true,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, page_type)
);
GRANT SELECT ON public.storefront_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_pages TO authenticated;
GRANT ALL ON public.storefront_pages TO service_role;
ALTER TABLE public.storefront_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published pages" ON public.storefront_pages FOR SELECT USING (is_published = true);
CREATE POLICY "Owner manage own pages" ON public.storefront_pages FOR ALL USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

-- 2) مناطق الشحن
CREATE TABLE IF NOT EXISTS public.storefront_shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  zone_name text NOT NULL,
  cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_fee numeric NOT NULL DEFAULT 0,
  free_shipping_min numeric,
  estimated_days_min int NOT NULL DEFAULT 1,
  estimated_days_max int NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.storefront_shipping_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_shipping_zones TO authenticated;
GRANT ALL ON public.storefront_shipping_zones TO service_role;
ALTER TABLE public.storefront_shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active zones" ON public.storefront_shipping_zones FOR SELECT USING (is_active = true);
CREATE POLICY "Owner manage zones" ON public.storefront_shipping_zones FOR ALL USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

-- 3) إضافة أعمدة الثيم وإعدادات SEO إلى employee_storefront_settings
ALTER TABLE public.employee_storefront_settings
  ADD COLUMN IF NOT EXISTS theme_preset text DEFAULT 'glass-aurora',
  ADD COLUMN IF NOT EXISTS theme_colors jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS theme_fonts jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_css text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS seo_keywords text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_1000 int DEFAULT 25,
  ADD COLUMN IF NOT EXISTS loyalty_redemption_rate numeric DEFAULT 0.05;
