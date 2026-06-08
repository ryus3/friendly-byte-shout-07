
CREATE UNIQUE INDEX IF NOT EXISTS uniq_storefront_custom_domain
ON public.employee_storefront_settings (lower(custom_domain))
WHERE custom_domain IS NOT NULL AND custom_domain <> '';
