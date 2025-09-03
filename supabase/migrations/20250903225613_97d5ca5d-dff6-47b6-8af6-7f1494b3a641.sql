
-- 1) ضمان أعمدة وآلية المزامنة في جدول الفواتير
ALTER TABLE public.delivery_invoices
  ADD COLUMN IF NOT EXISTS last_api_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS orders_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS merchant_id text;

-- فهرسة وقيود فريدة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'delivery_invoices_external_partner_key'
  ) THEN
    ALTER TABLE public.delivery_invoices
      ADD CONSTRAINT delivery_invoices_external_partner_key 
      UNIQUE (external_id, partner);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_delivery_invoices_external_id ON public.delivery_invoices (external_id);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_partner ON public.delivery_invoices (partner);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_received_status ON public.delivery_invoices (received, status_normalized);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_api_updated_at ON public.delivery_invoices (last_api_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_invoices_orders_synced_at ON public.delivery_invoices (orders_last_synced_at);

-- تفعيل الـ RLS وسياسة القراءة (إن لم تكن موجودة)
ALTER TABLE public.delivery_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='delivery_invoices' 
      AND policyname='Authenticated can view delivery_invoices'
  ) THEN
    CREATE POLICY "Authenticated can view delivery_invoices"
      ON public.delivery_invoices
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END$$;

-- 2) إنشاء/تأكيد جدول روابط الطلبات لكل فاتورة
CREATE TABLE IF NOT EXISTS public.delivery_invoice_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.delivery_invoices(id) ON DELETE CASCADE,
  order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
  external_order_id text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- قيد فريد وفهارس
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'delivery_invoice_orders_invoice_external_key'
  ) THEN
    ALTER TABLE public.delivery_invoice_orders
      ADD CONSTRAINT delivery_invoice_orders_invoice_external_key
      UNIQUE (invoice_id, external_order_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_dio_external_order_id ON public.delivery_invoice_orders (external_order_id);
CREATE INDEX IF NOT EXISTS idx_dio_order_id ON public.delivery_invoice_orders (order_id);
CREATE INDEX IF NOT EXISTS idx_dio_invoice_id ON public.delivery_invoice_orders (invoice_id);

-- Trigger بسيط لتحديث updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_timestamp'
  ) THEN
    CREATE FUNCTION public.set_updated_at_timestamp() 
    RETURNS trigger
    LANGUAGE plpgsql
    AS $f$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $f$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_dio_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_dio_set_updated_at
    BEFORE UPDATE ON public.delivery_invoice_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();
  END IF;
END$$;

-- تفعيل RLS وسياسة القراءة فقط
ALTER TABLE public.delivery_invoice_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='delivery_invoice_orders' 
      AND policyname='Authenticated can view delivery_invoice_orders'
  ) THEN
    CREATE POLICY "Authenticated can view delivery_invoice_orders"
      ON public.delivery_invoice_orders
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END$$;

-- 3) التأكد من تفعيل التريغرات المساعدة على جدول الفواتير
-- normalize_delivery_invoice_row
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_normalize_delivery_invoice_row') THEN
    CREATE TRIGGER trg_normalize_delivery_invoice_row
    BEFORE INSERT OR UPDATE ON public.delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_delivery_invoice_row();
  END IF;
END$$;

-- log_delivery_invoice_status_change
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_log_delivery_invoice_status_change') THEN
    CREATE TRIGGER trg_log_delivery_invoice_status_change
    AFTER UPDATE ON public.delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.log_delivery_invoice_status_change();
  END IF;
END$$;

-- propagate_invoice_received_to_orders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_propagate_invoice_received_to_orders') THEN
    CREATE TRIGGER trg_propagate_invoice_received_to_orders
    AFTER UPDATE ON public.delivery_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.propagate_invoice_received_to_orders();
  END IF;
END$$;

-- 4) دالة Upsert قائمة الفواتير دفعة واحدة (من نداء واحد get_merchant_invoices)
CREATE OR REPLACE FUNCTION public.upsert_alwaseet_invoice_list(p_invoices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $func$
DECLARE
  v_item jsonb;
  v_id text;
  v_amount numeric;
  v_count int;
  v_status text;
  v_merchant_id text;
  v_updated_at timestamptz;
  v_upserts int := 0;
BEGIN
  IF p_invoices IS NULL OR jsonb_typeof(p_invoices) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_invoices)
  LOOP
    v_id := v_item->>'id';
    v_amount := COALESCE((v_item->>'merchant_price')::numeric, 0);
    v_count := COALESCE((v_item->>'delivered_orders_count')::int, 0);
    v_status := v_item->>'status';
    v_merchant_id := v_item->>'merchant_id';
    v_updated_at := NULLIF(v_item->>'updated_at','')::timestamptz;

    INSERT INTO public.delivery_invoices (
      external_id, partner, amount, orders_count, status, merchant_id, issued_at,
      last_api_updated_at, raw
    ) VALUES (
      v_id, 'alwaseet', v_amount, v_count, v_status, v_merchant_id, v_updated_at,
      v_updated_at, v_item
    )
    ON CONFLICT (external_id, partner) DO UPDATE SET
      amount = EXCLUDED.amount,
      orders_count = EXCLUDED.orders_count,
      status = EXCLUDED.status,
      merchant_id = EXCLUDED.merchant_id,
      last_api_updated_at = COALESCE(EXCLUDED.last_api_updated_at, public.delivery_invoices.last_api_updated_at),
      raw = EXCLUDED.raw,
      updated_at = now();

    v_upserts := v_upserts + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_upserts);
END;
$func$;

-- 5) دالة وسم الفاتورة بعد مزامنة طلباتها
CREATE OR REPLACE FUNCTION public.mark_invoice_orders_synced(p_external_id text, p_partner text DEFAULT 'alwaseet')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $func$
BEGIN
  UPDATE public.delivery_invoices
  SET orders_last_synced_at = now(),
      last_synced_at = now(),
      updated_at = now()
  WHERE external_id = p_external_id
    AND partner = p_partner;
  RETURN FOUND;
END;
$func$;

-- 6) View للفواتير التي تحتاج جلب طلباتها (لتقليل النداءات)
CREATE OR REPLACE VIEW public.delivery_invoices_needing_sync AS
SELECT
  id,
  external_id,
  partner,
  last_api_updated_at,
  orders_last_synced_at,
  received,
  status,
  status_normalized
FROM public.delivery_invoices
WHERE
  -- لم تُجلب طلباتها من قبل
  orders_last_synced_at IS NULL
  OR
  -- أو تم تحديثها في API بعد آخر جلب للطلبات
  (last_api_updated_at IS NOT NULL AND orders_last_synced_at < last_api_updated_at);

GRANT SELECT ON public.delivery_invoices_needing_sync TO authenticated;
