-- حذف الدوال والتريغرات القديمة أولاً
DROP FUNCTION IF EXISTS public.reconcile_invoice_receipts() CASCADE;
DROP FUNCTION IF EXISTS public.sync_invoice_id_to_orders() CASCADE;
DROP FUNCTION IF EXISTS public.link_orders_by_external_id() CASCADE;
DROP FUNCTION IF EXISTS public.auto_link_dio_to_order() CASCADE;
DROP FUNCTION IF EXISTS public.sync_orders_on_invoice_received() CASCADE;

-- 1) دالة لتحديث delivery_partner_invoice_id من delivery_invoice_orders الموجودة
CREATE OR REPLACE FUNCTION public.sync_invoice_id_to_orders()
RETURNS TABLE(updated_count integer, order_ids text[]) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer := 0;
  v_order_ids text[] := ARRAY[]::text[];
BEGIN
  WITH updated AS (
    UPDATE orders o
    SET 
      delivery_partner_invoice_id = di.external_id,
      updated_at = NOW()
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON dio.invoice_id = di.id
    WHERE dio.order_id = o.id
      AND o.delivery_partner_invoice_id IS NULL
      AND di.external_id IS NOT NULL
    RETURNING o.id, o.order_number
  )
  SELECT COUNT(*)::integer, array_agg(order_number)
  INTO v_updated_count, v_order_ids
  FROM updated;

  RAISE NOTICE 'sync_invoice_id_to_orders: Updated % orders', v_updated_count;
  RETURN QUERY SELECT v_updated_count, COALESCE(v_order_ids, ARRAY[]::text[]);
END;
$$;

-- 2) دالة لربط الطلبات بالفواتير عبر external_order_id
CREATE OR REPLACE FUNCTION public.link_orders_by_external_id()
RETURNS TABLE(linked_count integer, order_ids text[]) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_count integer := 0;
  v_order_ids text[] := ARRAY[]::text[];
BEGIN
  WITH updated AS (
    UPDATE delivery_invoice_orders dio
    SET 
      order_id = o.id,
      updated_at = NOW()
    FROM orders o
    WHERE dio.external_order_id = o.delivery_partner_order_id
      AND dio.order_id IS NULL
      AND o.delivery_partner_order_id IS NOT NULL
    RETURNING o.id, o.order_number
  )
  SELECT COUNT(*)::integer, array_agg(order_number)
  INTO v_linked_count, v_order_ids
  FROM updated;

  RAISE NOTICE 'link_orders_by_external_id: Linked % orders', v_linked_count;
  PERFORM sync_invoice_id_to_orders();
  
  RETURN QUERY SELECT v_linked_count, COALESCE(v_order_ids, ARRAY[]::text[]);
END;
$$;

-- 3) دالة reconcile_invoice_receipts محسنة
CREATE OR REPLACE FUNCTION public.reconcile_invoice_receipts()
RETURNS TABLE(
  order_id uuid,
  order_number text,
  invoice_id text,
  action text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM link_orders_by_external_id();
  
  RETURN QUERY
  WITH orders_to_update AS (
    SELECT DISTINCT 
      o.id as oid,
      o.order_number as onum,
      di.external_id as inv_id,
      di.received_at as recv_at
    FROM orders o
    JOIN delivery_invoice_orders dio ON dio.order_id = o.id
    JOIN delivery_invoices di ON dio.invoice_id = di.id
    WHERE di.received = true
      AND (o.receipt_received = false OR o.receipt_received IS NULL)
  ),
  updated AS (
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(otu.recv_at, NOW()),
      updated_at = NOW()
    FROM orders_to_update otu
    WHERE o.id = otu.oid
    RETURNING o.id, o.order_number, otu.inv_id
  )
  SELECT u.id, u.order_number, u.inv_id, 'receipt_updated'::text
  FROM updated u;
END;
$$;

-- 4) Trigger على delivery_invoice_orders لربط تلقائي
CREATE OR REPLACE FUNCTION public.auto_link_dio_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_invoice_id text;
  v_is_received boolean;
  v_received_at timestamptz;
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT id INTO v_order_id
  FROM orders
  WHERE delivery_partner_order_id = NEW.external_order_id
  LIMIT 1;
  
  IF v_order_id IS NOT NULL THEN
    NEW.order_id := v_order_id;
    
    SELECT di.external_id, di.received, di.received_at
    INTO v_invoice_id, v_is_received, v_received_at
    FROM delivery_invoices di
    WHERE di.id = NEW.invoice_id;
    
    UPDATE orders
    SET 
      delivery_partner_invoice_id = v_invoice_id,
      receipt_received = CASE WHEN v_is_received THEN true ELSE receipt_received END,
      receipt_received_at = CASE WHEN v_is_received AND receipt_received_at IS NULL THEN v_received_at ELSE receipt_received_at END,
      updated_at = NOW()
    WHERE id = v_order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_dio_to_order ON delivery_invoice_orders;
CREATE TRIGGER trg_auto_link_dio_to_order
  BEFORE INSERT ON delivery_invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_dio_to_order();

-- 5) Trigger عند استلام الفاتورة
CREATE OR REPLACE FUNCTION public.sync_orders_on_invoice_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.received = true AND (OLD.received = false OR OLD.received IS NULL) THEN
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(NEW.received_at, NOW()),
      updated_at = NOW()
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = NEW.id
      AND dio.order_id = o.id
      AND (o.receipt_received = false OR o.receipt_received IS NULL);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_orders_on_invoice_received ON delivery_invoices;
CREATE TRIGGER trg_sync_orders_on_invoice_received
  AFTER UPDATE OF received ON delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION sync_orders_on_invoice_received();