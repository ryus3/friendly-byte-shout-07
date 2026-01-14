-- ✅ تحسين دالة الربط للتحقق من delivery_partner_order_id أيضاً
DROP FUNCTION IF EXISTS public.link_invoice_orders_to_orders();

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
  -- ✅ ربط عبر tracking_number
  WITH linked_by_tracking AS (
    UPDATE delivery_invoice_orders dio
    SET order_id = o.id
    FROM orders o
    WHERE dio.order_id IS NULL
      AND dio.external_order_id IS NOT NULL
      AND o.tracking_number = dio.external_order_id
    RETURNING dio.id
  )
  SELECT COUNT(*)::integer INTO v_linked_count FROM linked_by_tracking;

  -- ✅ ربط عبر delivery_partner_order_id (fallback)
  WITH linked_by_dp_id AS (
    UPDATE delivery_invoice_orders dio
    SET order_id = o.id
    FROM orders o
    WHERE dio.order_id IS NULL
      AND dio.external_order_id IS NOT NULL
      AND o.delivery_partner_order_id = dio.external_order_id
    RETURNING dio.id
  )
  SELECT v_linked_count + COUNT(*)::integer INTO v_linked_count FROM linked_by_dp_id;

  -- ✅ تحديث delivery_partner_invoice_id في orders
  UPDATE orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON di.id = dio.invoice_id
  WHERE o.id = dio.order_id
    AND o.delivery_partner_invoice_id IS NULL
    AND dio.order_id IS NOT NULL;

  -- ✅ تحديث receipt_received للطلبات المرتبطة بفواتير مستلمة
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

-- ✅ تحديث trigger الربط التلقائي للتحقق من delivery_partner_order_id أيضاً
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
    -- محاولة الربط بـ tracking_number أولاً
    SELECT id INTO v_order_id
    FROM orders
    WHERE tracking_number = NEW.external_order_id
    LIMIT 1;
    
    -- إذا لم يوجد، محاولة الربط بـ delivery_partner_order_id
    IF v_order_id IS NULL THEN
      SELECT id INTO v_order_id
      FROM orders
      WHERE delivery_partner_order_id = NEW.external_order_id
      LIMIT 1;
    END IF;
    
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

-- تشغيل الربط مرة أخرى بعد التحسين
SELECT * FROM public.link_invoice_orders_to_orders();