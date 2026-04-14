CREATE TABLE IF NOT EXISTS public.package_sizes_cache (
  id SERIAL PRIMARY KEY,
  partner_name TEXT NOT NULL DEFAULT 'alwaseet',
  external_id TEXT NOT NULL,
  size_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_name, external_id)
);

ALTER TABLE public.package_sizes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read package_sizes_cache" ON public.package_sizes_cache
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.package_sizes_cache (partner_name, external_id, size_name) VALUES
  ('alwaseet', '1', 'Normal'),
  ('alwaseet', '2', 'Medium'),
  ('alwaseet', '3', 'Large'),
  ('alwaseet', '4', 'X-Large'),
  ('modon', '1', 'Normal'),
  ('modon', '2', 'Medium'),
  ('modon', '3', 'Large'),
  ('modon', '4', 'X-Large')
ON CONFLICT (partner_name, external_id) DO NOTHING;