-- ✅ إصلاح الفواتير: Backfill issued_at وتوحيد التريغرز وإصلاح الربط

-- ========== المحور 1: Backfill issued_at للفواتير التي issued_at = NULL ==========
UPDATE delivery_invoices
SET issued_at = COALESCE(
  last_api_updated_at,
  (raw->>'updated_at')::timestamptz,
  updated_at,
  created_at,
  now()
)
WHERE issued_at IS NULL;

-- ========== المحور 2: حذف الدوال القديمة ثم إنشاء الجديدة ==========
DROP FUNCTION IF EXISTS public.link_invoice_orders_to_orders();
DROP FUNCTION IF EXISTS public.reconcile_invoice_receipts();

-- دالة ربط الطلبات
CREATE FUNCTION public.link_invoice_orders_to_orders()
RETURNS TABLE(linked_count integer, updated_orders_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_count integer := 0;
  v_updated_orders_count integer := 0;
BEGIN
  -- ربط delivery_invoice_orders بـ orders عبر tracking_number
  WITH linked AS (
    UPDATE delivery_invoice_orders dio
    SET order_id = o.id
    FROM orders o
    WHERE dio.order_id IS NULL
      AND dio.external_order_id IS NOT NULL
      AND o.tracking_number = dio.external_order_id
    RETURNING dio.id, o.id as order_id
  )
  SELECT COUNT(*)::integer INTO v_linked_count FROM linked;

  -- تحديث delivery_partner_invoice_id في orders
  UPDATE orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON di.id = dio.invoice_id
  WHERE o.id = dio.order_id
    AND o.delivery_partner_invoice_id IS NULL
    AND dio.order_id IS NOT NULL;

  -- تحديث receipt_received للطلبات المرتبطة بفواتير مستلمة
  WITH updated AS (
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, now())
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE o.id = dio.order_id
      AND di.received = true
      AND (o.receipt_received IS NULL OR o.receipt_received = false)
    RETURNING o.id
  )
  SELECT COUNT(*)::integer INTO v_updated_orders_count FROM updated;

  RETURN QUERY SELECT v_linked_count, v_updated_orders_count;
END;
$$;

-- دالة تسوية الفواتير المستلمة (تُرجع عدد الطلبات المحدثة)
CREATE FUNCTION public.reconcile_invoice_receipts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH updated_orders AS (
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, now())
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE o.id = dio.order_id
      AND di.received = true
      AND (o.receipt_received IS NULL OR o.receipt_received = false)
    RETURNING o.id
  )
  SELECT COUNT(*)::integer INTO v_count FROM updated_orders;
  
  RETURN v_count;
END;
$$;

-- ========== المحور 3: Trigger عند تحديث received في delivery_invoices ==========
CREATE OR REPLACE FUNCTION public.sync_orders_on_invoice_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.received = true AND (OLD.received IS NULL OR OLD.received = false) THEN
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, NEW.received_at, now())
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND o.id = dio.order_id
      AND (o.receipt_received IS NULL OR o.receipt_received = false);
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف التريغرات القديمة
DROP TRIGGER IF EXISTS trg_sync_orders_on_invoice_received ON delivery_invoices;
DROP TRIGGER IF EXISTS trigger_auto_update_invoice_orders ON delivery_invoices;

-- إنشاء التريغر الموحد
CREATE TRIGGER trg_sync_orders_on_invoice_received
AFTER UPDATE ON delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_orders_on_invoice_received();

-- ========== المحور 4: Trigger عند إدخال delivery_invoice_orders ==========
CREATE OR REPLACE FUNCTION public.auto_link_dio_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_invoice_received boolean;
  v_received_at timestamptz;
BEGIN
  IF NEW.order_id IS NULL AND NEW.external_order_id IS NOT NULL THEN
    SELECT id INTO v_order_id
    FROM orders
    WHERE tracking_number = NEW.external_order_id
    LIMIT 1;
    
    IF v_order_id IS NOT NULL THEN
      NEW.order_id := v_order_id;
    END IF;
  END IF;
  
  SELECT received, received_at INTO v_invoice_received, v_received_at
  FROM delivery_invoices
  WHERE id = NEW.invoice_id;
  
  IF NEW.order_id IS NOT NULL AND v_invoice_received = true THEN
    UPDATE orders
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(receipt_received_at, v_received_at, now()),
      delivery_partner_invoice_id = (SELECT external_id FROM delivery_invoices WHERE id = NEW.invoice_id)
    WHERE id = NEW.order_id
      AND (receipt_received IS NULL OR receipt_received = false);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_dio_to_order ON delivery_invoice_orders;

CREATE TRIGGER trg_auto_link_dio_to_order
BEFORE INSERT OR UPDATE ON delivery_invoice_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_dio_to_order();

-- ========== المحور 5: تشغيل الربط والتسوية فوراً ==========
SELECT * FROM public.link_invoice_orders_to_orders();
SELECT public.reconcile_invoice_receipts() as reconciled_count;