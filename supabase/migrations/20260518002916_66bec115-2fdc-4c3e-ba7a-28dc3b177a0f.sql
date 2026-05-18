-- 🛡️ حائط حماية أخير: منع حذف الطلبات الخارجية المرتبطة بفاتورة أو إيصال مستلم
CREATE OR REPLACE FUNCTION public.guard_external_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- نسمح بالحذف بدون قيود للطلبات المؤرشفة أو الراجعة أو الملغاة
  IF COALESCE(OLD.isarchived, false) = true THEN
    RETURN OLD;
  END IF;
  IF OLD.status IN ('returned', 'returned_in_stock', 'cancelled', 'rejected') THEN
    RETURN OLD;
  END IF;
  IF COALESCE(OLD.delivery_status, '') IN ('17', '31', '32') THEN
    RETURN OLD;
  END IF;

  -- ⛔ الطلب لديه فاتورة شركة توصيل مرتبطة → ممنوع الحذف
  IF OLD.delivery_partner_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'cannot_delete_order_with_delivery_invoice: order % مرتبط بفاتورة شركة التوصيل %', OLD.order_number, OLD.delivery_partner_invoice_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- ⛔ الطلب مستلم إيصاله → ممنوع الحذف
  IF COALESCE(OLD.receipt_received, false) = true THEN
    RAISE EXCEPTION 'cannot_delete_order_with_received_receipt: order % إيصاله مستلم', OLD.order_number
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_external_order_delete ON public.orders;
CREATE TRIGGER trg_guard_external_order_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_external_order_delete();

COMMENT ON FUNCTION public.guard_external_order_delete() IS
'حائط حماية: يمنع حذف الطلبات الخارجية المرتبطة بفاتورة شركة توصيل أو إيصال مستلم. يسمح بالحذف فقط للطلبات المؤرشفة/الراجعة/الملغاة.';