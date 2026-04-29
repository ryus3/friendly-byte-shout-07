CREATE TABLE IF NOT EXISTS public.delivery_partners_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_key text NOT NULL UNIQUE,
  display_name_ar text NOT NULL,
  display_name_en text,
  base_url text NOT NULL,
  proxy_url text,
  auth_type text NOT NULL DEFAULT 'login',
  auth_strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  endpoints jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_partners_registry_active
  ON public.delivery_partners_registry(is_active);

ALTER TABLE public.delivery_partners_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_partners_registry_read_authenticated"
ON public.delivery_partners_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "delivery_partners_registry_admin_insert"
ON public.delivery_partners_registry FOR INSERT TO authenticated
WITH CHECK (public.check_user_role(auth.uid(), 'super_admin') OR public.check_user_role(auth.uid(), 'deputy'));

CREATE POLICY "delivery_partners_registry_admin_update"
ON public.delivery_partners_registry FOR UPDATE TO authenticated
USING (public.check_user_role(auth.uid(), 'super_admin') OR public.check_user_role(auth.uid(), 'deputy'))
WITH CHECK (public.check_user_role(auth.uid(), 'super_admin') OR public.check_user_role(auth.uid(), 'deputy'));

CREATE POLICY "delivery_partners_registry_admin_delete"
ON public.delivery_partners_registry FOR DELETE TO authenticated
USING ((public.check_user_role(auth.uid(), 'super_admin') OR public.check_user_role(auth.uid(), 'deputy')) AND is_builtin = false);

INSERT INTO public.delivery_partners_registry
  (partner_key, display_name_ar, display_name_en, base_url, auth_type, is_builtin, endpoints)
VALUES
  ('alwaseet', 'الوسيط', 'AlWaseet',
   'https://api.alwaseet-iq.net/v1/merchant', 'login', true,
   '{"login":"login","listOrders":"merchant-orders","createOrder":"create-order"}'::jsonb),
  ('modon', 'مدن', 'Modon',
   'https://mcht.modon-express.net/v1/merchant', 'login', true,
   '{"login":"login","listOrders":"merchant-orders","createOrder":"create-order","editOrder":"edit-order","deleteOrders":"delete_orders"}'::jsonb)
ON CONFLICT (partner_key) DO NOTHING;

CREATE TRIGGER update_delivery_partners_registry_updated_at
BEFORE UPDATE ON public.delivery_partners_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();