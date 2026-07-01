-- 0. Add primary key to orders_backup so ON CONFLICT(id) works
ALTER TABLE public.orders_backup ADD CONSTRAINT orders_backup_pkey PRIMARY KEY (id);

-- 1. DELETE / UPDATE / INSERT policies for orders_backup
CREATE POLICY "المديرون يحذفون backup الطلبات"
  ON public.orders_backup FOR DELETE
  USING (public.is_admin_or_deputy());

CREATE POLICY "المديرون يعدلون backup الطلبات"
  ON public.orders_backup FOR UPDATE
  USING (public.is_admin_or_deputy())
  WITH CHECK (public.is_admin_or_deputy());

CREATE POLICY "النظام يُدرج backup الطلبات"
  ON public.orders_backup FOR INSERT
  WITH CHECK (true);

-- 2. Robust backup trigger (logs errors, doesn't swallow silently)
CREATE OR REPLACE FUNCTION public.backup_order_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  BEGIN
    INSERT INTO public.orders_backup (
      id, order_number, customer_id, customer_name, customer_phone,
      customer_address, customer_city, customer_province, status, total_amount,
      discount, delivery_fee, final_amount, payment_status, delivery_status,
      delivery_partner, tracking_number, notes, created_by, assigned_to,
      created_at, updated_at, receipt_received, receipt_received_at,
      receipt_received_by, custom_discount, discount_reason, cash_source_id,
      payment_received_source_id, isarchived, qr_id, customer_phone2,
      delivery_partner_order_id, delivery_partner_invoice_id,
      delivery_partner_invoice_date, invoice_received_at, invoice_received_by,
      alwaseet_city_id, alwaseet_region_id, delivery_account_code,
      sales_amount, delivery_account_used, source,
      deleted_at, deleted_by, deletion_reason, delete_source
    ) VALUES (
      OLD.id, OLD.order_number, OLD.customer_id, OLD.customer_name, OLD.customer_phone,
      OLD.customer_address, OLD.customer_city, OLD.customer_province, OLD.status, OLD.total_amount,
      OLD.discount, OLD.delivery_fee, OLD.final_amount, OLD.payment_status, OLD.delivery_status,
      OLD.delivery_partner, OLD.tracking_number, OLD.notes, OLD.created_by, OLD.assigned_to,
      OLD.created_at, OLD.updated_at, OLD.receipt_received, OLD.receipt_received_at,
      OLD.receipt_received_by, OLD.custom_discount, OLD.discount_reason, OLD.cash_source_id,
      OLD.payment_received_source_id, OLD.isarchived, OLD.qr_id, OLD.customer_phone2,
      OLD.delivery_partner_order_id, OLD.delivery_partner_invoice_id,
      OLD.delivery_partner_invoice_date, OLD.invoice_received_at, OLD.invoice_received_by,
      OLD.alwaseet_city_id, OLD.alwaseet_region_id, OLD.delivery_account_code,
      OLD.sales_amount, OLD.delivery_account_used, OLD.source,
      now(), v_uid, NULL, CASE WHEN v_uid IS NULL THEN 'system' ELSE 'manual' END
    )
    ON CONFLICT (id) DO UPDATE
      SET deleted_at = now(),
          deleted_by = COALESCE(EXCLUDED.deleted_by, public.orders_backup.deleted_by),
          delete_source = COALESCE(EXCLUDED.delete_source, public.orders_backup.delete_source);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'backup_order_before_delete failed for order %: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END;
$$;

-- 3. Recover ORD001916 / 150022546 from notification data
INSERT INTO public.orders_backup (
  id, order_number, tracking_number, status, delivery_status,
  delivery_partner, deleted_at, delete_source, deletion_reason,
  created_at, updated_at
) VALUES (
  '33d5369f-245b-46b6-8df8-1ea7b3ffe2c9'::uuid,
  'ORD001916',
  '150022546',
  'pending',
  '1',
  'alwaseet',
  '2026-06-30 00:40:27+00'::timestamptz,
  'manual',
  'مُستعاد من الإشعارات — فشل trigger النسخ الاحتياطي عند الحذف',
  '2026-06-30 00:40:27+00'::timestamptz,
  now()
) ON CONFLICT (id) DO NOTHING;

-- 4. Hard-delete RPC
CREATE OR REPLACE FUNCTION public.admin_hard_delete_order(
  p_backup_id uuid DEFAULT NULL,
  p_auto_log_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_number text;
  v_tracking text;
BEGIN
  IF NOT public.is_admin_or_deputy() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_backup_id IS NOT NULL THEN
    SELECT order_number, tracking_number INTO v_order_number, v_tracking
    FROM public.orders_backup WHERE id = p_backup_id;
    DELETE FROM public.orders_backup WHERE id = p_backup_id;
  END IF;

  IF p_auto_log_id IS NOT NULL THEN
    SELECT order_number, tracking_number INTO v_order_number, v_tracking
    FROM public.auto_delete_log WHERE id = p_auto_log_id;
    DELETE FROM public.auto_delete_log WHERE id = p_auto_log_id;
  END IF;

  IF v_order_number IS NOT NULL OR v_tracking IS NOT NULL THEN
    DELETE FROM public.notifications
     WHERE (v_order_number IS NOT NULL AND message ILIKE '%' || v_order_number || '%')
        OR (v_tracking     IS NOT NULL AND message ILIKE '%' || v_tracking     || '%');
  END IF;

  RETURN jsonb_build_object('success', true, 'order_number', v_order_number, 'tracking_number', v_tracking);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_hard_delete_order(uuid, uuid) TO authenticated;