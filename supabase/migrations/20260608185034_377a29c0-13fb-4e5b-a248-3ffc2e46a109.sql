
-- Custom categories & departments per storefront
CREATE TABLE IF NOT EXISTS public.storefront_custom_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('category','department')),
  name text NOT NULL,
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  linked_product_ids uuid[] NOT NULL DEFAULT '{}',
  linked_category_ids uuid[] NOT NULL DEFAULT '{}',
  linked_department_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storefront_custom_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storefront_custom_categories TO authenticated;
GRANT ALL ON public.storefront_custom_categories TO service_role;

ALTER TABLE public.storefront_custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their custom storefront categories"
  ON public.storefront_custom_categories
  FOR ALL
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Public can read visible custom categories"
  ON public.storefront_custom_categories
  FOR SELECT
  TO anon
  USING (is_visible = true);

CREATE INDEX IF NOT EXISTS idx_storefront_custom_categories_employee
  ON public.storefront_custom_categories(employee_id, type, display_order);

CREATE OR REPLACE FUNCTION public.update_storefront_custom_categories_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_storefront_custom_categories_updated_at ON public.storefront_custom_categories;
CREATE TRIGGER trg_storefront_custom_categories_updated_at
BEFORE UPDATE ON public.storefront_custom_categories
FOR EACH ROW EXECUTE FUNCTION public.update_storefront_custom_categories_updated_at();
