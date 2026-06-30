
-- إضافة أعمدة تتبع الحذف الفعلي إلى orders_backup
ALTER TABLE public.orders_backup
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS delete_source text;

-- ملء deleted_at للسجلات القديمة من created_at لو فاضي
UPDATE public.orders_backup
SET deleted_at = COALESCE(deleted_at, created_at)
WHERE deleted_at IS NULL;

-- Trigger BEFORE DELETE on orders يحفظ نسخة احتياطية مع توقيت الحذف الحقيقي
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
  -- نُدخل صفّاً مع timestamp الحذف الحقيقي
  INSERT INTO public.orders_backup (
    id, order_number, customer_id, customer_name, customer_phone, customer_address,
    customer_city, customer_province, status, total_amount, discount, delivery_fee,
    final_amount, payment_status, delivery_status, delivery_partner, tracking_number,
    notes, created_by, assigned_to, created_at, updated_at, receipt_received,
    receipt_received_at, receipt_received_by, custom_discount, discount_reason,
    cash_source_id, payment_received_source_id, isarchived, qr_id, customer_phone2,
    delivery_partner_order_id, delivery_partner_invoice_id, delivery_partner_invoice_date,
    invoice_received_at, invoice_received_by, alwaseet_city_id, alwaseet_region_id,
    delivery_account_code, sales_amount, delivery_account_used, source,
    deleted_at, deleted_by, deletion_reason, delete_source
  ) VALUES (
    OLD.id, OLD.order_number, OLD.customer_id, OLD.customer_name, OLD.customer_phone,
    OLD.customer_address, OLD.customer_city, OLD.customer_province, OLD.status,
    OLD.total_amount, OLD.discount, OLD.delivery_fee, OLD.final_amount,
    OLD.payment_status, OLD.delivery_status, OLD.delivery_partner, OLD.tracking_number,
    OLD.notes, OLD.created_by, OLD.assigned_to, OLD.created_at, OLD.updated_at,
    OLD.receipt_received, OLD.receipt_received_at, OLD.receipt_received_by,
    OLD.custom_discount, OLD.discount_reason, OLD.cash_source_id,
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
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD; -- لا نوقف الحذف لأي خطأ في النسخ الاحتياطي
END;
$$;

DROP TRIGGER IF EXISTS backup_order_before_delete_trg ON public.orders;
CREATE TRIGGER backup_order_before_delete_trg
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.backup_order_before_delete();
