
-- 1) Custom domains
CREATE TABLE IF NOT EXISTS public.storefront_custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  domain text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_custom_domains TO authenticated;
GRANT ALL ON public.storefront_custom_domains TO service_role;
ALTER TABLE public.storefront_custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_domain_all ON public.storefront_custom_domains
  FOR ALL TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());

-- 2) Employee storefront categories
CREATE TABLE IF NOT EXISTS public.employee_storefront_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  category_id uuid,
  department_id uuid,
  display_order int NOT NULL DEFAULT 0,
  custom_image_url text,
  custom_label text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_storefront_categories TO authenticated;
GRANT SELECT ON public.employee_storefront_categories TO anon;
GRANT ALL ON public.employee_storefront_categories TO service_role;
ALTER TABLE public.employee_storefront_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_cats_all ON public.employee_storefront_categories
  FOR ALL TO authenticated USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid());
CREATE POLICY public_read_cats ON public.employee_storefront_categories
  FOR SELECT TO anon USING (is_visible = true);

-- 3) Featured + manual order on per-employee product descriptions
ALTER TABLE public.employee_product_descriptions
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;
