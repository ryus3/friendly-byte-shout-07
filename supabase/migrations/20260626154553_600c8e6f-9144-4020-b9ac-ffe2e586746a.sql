
-- ENUM types
DO $$ BEGIN
  CREATE TYPE public.off_channel_collection_type AS ENUM (
    'electronic_payment','bank_transfer','employee_cash','full_discount','owner_delivery_only'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.off_channel_collection_status AS ENUM (
    'pending_classification','pending_owner_confirmation','settled','waived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLE
CREATE TABLE IF NOT EXISTS public.off_channel_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.delivery_invoices(id) ON DELETE SET NULL,
  collector_user_id uuid,  -- الموظف/الشخص الذي قبض المبلغ
  owner_user_id uuid,      -- مالك المنتج (المستحق)
  collection_type public.off_channel_collection_type,
  customer_paid_amount numeric DEFAULT 0,
  delivery_fee_absorbed numeric DEFAULT 0,
  employee_profit_share numeric DEFAULT 0,
  owner_due_amount numeric DEFAULT 0,
  note text,
  status public.off_channel_collection_status NOT NULL DEFAULT 'pending_classification',
  classified_at timestamptz,
  confirmed_at timestamptz,
  cash_movement_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_occ_status ON public.off_channel_collections(status);
CREATE INDEX IF NOT EXISTS idx_occ_owner ON public.off_channel_collections(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_occ_collector ON public.off_channel_collections(collector_user_id);
CREATE INDEX IF NOT EXISTS idx_occ_invoice ON public.off_channel_collections(invoice_id);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.off_channel_collections TO authenticated;
GRANT ALL ON public.off_channel_collections TO service_role;

-- RLS
ALTER TABLE public.off_channel_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "occ_select_involved" ON public.off_channel_collections
  FOR SELECT TO authenticated
  USING (
    auth.uid() = collector_user_id
    OR auth.uid() = owner_user_id
    OR public.is_admin_or_deputy()
  );

CREATE POLICY "occ_insert_collector_or_admin" ON public.off_channel_collections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = collector_user_id
    OR public.is_admin_or_deputy()
  );

CREATE POLICY "occ_update_involved" ON public.off_channel_collections
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = collector_user_id
    OR auth.uid() = owner_user_id
    OR public.is_admin_or_deputy()
  );

CREATE POLICY "occ_delete_admin" ON public.off_channel_collections
  FOR DELETE TO authenticated
  USING (public.is_admin_or_deputy());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_occ()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_occ_updated_at ON public.off_channel_collections;
CREATE TRIGGER trg_occ_updated_at
  BEFORE UPDATE ON public.off_channel_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_occ();

-- Auto-detect off-channel orders from delivery_invoice_orders
CREATE OR REPLACE FUNCTION public.auto_detect_off_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.amount, 0) <> 0 THEN RETURN NEW; END IF;

  SELECT o.id, o.order_type, o.status, o.delivery_status, o.delivery_fee, o.created_by, o.final_amount
    INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- شروط الـ off-channel: طلب اعتيادي + مُسلَّم + غير راجع
  IF COALESCE(v_order.order_type, 'regular') <> 'regular' THEN RETURN NEW; END IF;
  IF v_order.status = 'returned' THEN RETURN NEW; END IF;
  IF v_order.delivery_status::text <> '4' THEN RETURN NEW; END IF;

  INSERT INTO public.off_channel_collections (
    order_id, invoice_id, collector_user_id, owner_user_id,
    delivery_fee_absorbed, customer_paid_amount, status
  ) VALUES (
    NEW.order_id, NEW.invoice_id, v_order.created_by, NEW.owner_user_id,
    COALESCE(v_order.delivery_fee, 0),
    COALESCE(v_order.final_amount, 0),
    'pending_classification'
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_detect_off_channel ON public.delivery_invoice_orders;
CREATE TRIGGER trg_auto_detect_off_channel
  AFTER INSERT OR UPDATE ON public.delivery_invoice_orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_detect_off_channel();

-- Backfill: ابحث عن كل الطلبات الحالية المستحقة للتصنيف
INSERT INTO public.off_channel_collections (
  order_id, invoice_id, collector_user_id, owner_user_id,
  delivery_fee_absorbed, customer_paid_amount, status
)
SELECT
  o.id, dio.invoice_id, o.created_by, dio.owner_user_id,
  COALESCE(o.delivery_fee, 0), COALESCE(o.final_amount, 0),
  'pending_classification'
FROM public.delivery_invoice_orders dio
JOIN public.orders o ON o.id = dio.order_id
WHERE COALESCE(dio.amount, 0) = 0
  AND COALESCE(o.order_type, 'regular') = 'regular'
  AND o.status <> 'returned'
  AND o.delivery_status::text = '4'
ON CONFLICT (order_id) DO NOTHING;
