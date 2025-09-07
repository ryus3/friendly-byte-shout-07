-- 1) تعديل تريغر استلام الفاتورة: السماح بإنشاء رقم فاتورة داخلي للطلبات المحلية
CREATE OR REPLACE FUNCTION public.handle_receipt_received_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- When invoice receipt toggles true
  IF NEW.receipt_received = true AND COALESCE(OLD.receipt_received, false) = false THEN
    -- للطلبات المحلية: إنشاء رقم فاتورة داخلي تلقائي
    IF LOWER(COALESCE(NEW.delivery_partner, '')) IN ('محلي', 'local', '') OR NEW.delivery_partner IS NULL THEN
      -- إنشاء رقم فاتورة داخلي إذا لم يكن موجوداً
      IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
        NEW.delivery_partner_invoice_id := 'LOCAL-' || COALESCE(NEW.order_number, NEW.id::text);
      END IF;
    ELSE
      -- للطلبات الخارجية: التحقق من وجود رقم فاتورة فعلي
      IF NEW.delivery_partner_invoice_id IS NULL OR TRIM(NEW.delivery_partner_invoice_id) = '' THEN
        RAISE WARNING 'محاولة تعيين receipt_received = true بدون رقم فاتورة للطلب %', COALESCE(NEW.order_number, NEW.id::text);
        NEW.receipt_received := false;
        RETURN NEW;
      END IF;
    END IF;

    -- Stamp metadata if missing
    IF NEW.receipt_received_at IS NULL THEN
      NEW.receipt_received_at := now();
    END IF;
    IF NEW.receipt_received_by IS NULL THEN
      NEW.receipt_received_by := COALESCE(auth.uid(), NEW.created_by);
    END IF;

    -- طلبات المدير فقط تنتقل مباشرة إلى completed عند الاستلام
    IF NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid THEN
      IF NEW.status = 'delivered' THEN
        NEW.status := 'completed';
      END IF;
    END IF;
  END IF;

  -- When invoice receipt is set to false, clear the timestamp and related data
  IF NEW.receipt_received = false AND COALESCE(OLD.receipt_received, false) = true THEN
    NEW.receipt_received_at := NULL;
    NEW.receipt_received_by := NULL;
    -- Clear invoice ID when receipt is marked as not received
    NEW.delivery_partner_invoice_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) تصحيح حالة الطلب RYUS-299923 ليكون جاهزاً للتدفق الجديد
UPDATE public.orders 
SET 
  status = 'delivered',
  delivery_partner_invoice_id = NULL,
  receipt_received = false,
  receipt_received_at = NULL,
  receipt_received_by = NULL,
  updated_at = now()
WHERE order_number = 'RYUS-299923';