
ALTER TABLE public.employee_banners
  ADD COLUMN IF NOT EXISTS link_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS link_target_id UUID,
  ADD COLUMN IF NOT EXISTS link_products UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS link_categories UUID[] DEFAULT ARRAY[]::UUID[],
  ADD COLUMN IF NOT EXISTS link_url TEXT,
  ADD COLUMN IF NOT EXISTS link_label TEXT;

COMMENT ON COLUMN public.employee_banners.link_type IS 'none | product | category | custom_list | url';
