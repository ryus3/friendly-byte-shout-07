-- ====================================================================
-- إصلاح الطلب 106246427 والفاتورة 2234470 + منع المشكلة مستقبلاً
-- ====================================================================

-- 1️⃣ إصلاح الطلب 106246427 فوراً
UPDATE public.orders
SET 
  receipt_received = true,
  receipt_received_at = NOW(),
  receipt_received_by = '91484496-b887-44f7-9e5d-be9db5567604',
  delivery_partner_invoice_id = '2234470',
  delivery_partner_invoice_date = '2025-10-09 17:57:49.244065+00',
  updated_at = NOW()
WHERE id = '22ee06f9-5235-46d9-8da0-370280ece13d';

-- تحديث سجل الربح للطلب
UPDATE public.profits
SET 
  status = 'invoice_received',
  updated_at = NOW()
WHERE order_id = '22ee06f9-5235-46d9-8da0-370280ece13d'
  AND status = 'pending';

-- 2️⃣ إصلاح باقي الطلبات في نفس الفاتورة (الـ 20 طلب الآخرين)
UPDATE public.orders o
SET 
  receipt_received = true,
  receipt_received_at = '2025-10-09 17:57:49.244065+00',
  receipt_received_by = '91484496-b887-44f7-9e5d-be9db5567604',
  delivery_partner_invoice_id = '2234470',
  delivery_partner_invoice_date = '2025-10-09 17:57:49.244065+00',
  updated_at = NOW()
FROM public.delivery_invoice_orders dio
WHERE dio.invoice_id = '255d5117-3435-4d53-b35c-45732f2a624b'
  AND dio.order_id = o.id
  AND o.receipt_received = false;

-- تحديث سجلات الأرباح للطلبات المُحدثة
UPDATE public.profits p
SET 
  status = 'invoice_received',
  updated_at = NOW()
FROM public.delivery_invoice_orders dio
WHERE dio.invoice_id = '255d5117-3435-4d53-b35c-45732f2a624b'
  AND dio.order_id = p.order_id
  AND p.status = 'pending';

-- 3️⃣ إنشاء trigger لمنع المشكلة مستقبلاً 100%
CREATE OR REPLACE FUNCTION public.auto_update_linked_orders_on_invoice_receipt()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_orders integer := 0;
  v_manager_id uuid := '91484496-b887-44f7-9e5d-be9db5567604';
BEGIN
  -- فقط عندما تتغير حالة الاستلام من false إلى true
  IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
    
    -- تحديث جميع الطلبات المرتبطة بهذه الفاتورة
    WITH updated AS (
      UPDATE public.orders o
      SET 
        receipt_received = true,
        receipt_received_at = NOW(),
        receipt_received_by = COALESCE(
          (SELECT user_id FROM public.delivery_partner_tokens 
           WHERE partner_name = 'alwaseet' AND is_active = true 
           ORDER BY last_used_at DESC NULLS LAST LIMIT 1),
          v_manager_id
        ),
        delivery_partner_invoice_id = NEW.external_id,
        delivery_partner_invoice_date = NEW.issued_at,
        updated_at = NOW()
      FROM public.delivery_invoice_orders dio
      WHERE dio.invoice_id = NEW.id
        AND dio.order_id = o.id
        AND o.receipt_received = false
      RETURNING o.id
    )
    SELECT COUNT(*) INTO v_updated_orders FROM updated;
    
    -- تحديث سجلات الأرباح للطلبات المُحدثة
    UPDATE public.profits p
    SET 
      status = 'invoice_received',
      updated_at = NOW()
    FROM public.delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = p.order_id
      AND p.status = 'pending';
    
    RAISE NOTICE 'Auto-updated % orders for invoice %', v_updated_orders, NEW.external_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء الـ trigger (حذف القديم إن وُجد)
DROP TRIGGER IF EXISTS trigger_auto_update_invoice_orders ON public.delivery_invoices;

CREATE TRIGGER trigger_auto_update_invoice_orders
  AFTER UPDATE ON public.delivery_invoices
  FOR EACH ROW
  WHEN (NEW.received = true AND (OLD.received IS NULL OR OLD.received = false))
  EXECUTE FUNCTION public.auto_update_linked_orders_on_invoice_receipt();