
-- ===== STEP 1: Remove order 121313050 from invoice 2618773 completely =====

-- 1a. Delete the linking record from delivery_invoice_orders
DELETE FROM delivery_invoice_orders 
WHERE id = 'acbfc0dd-6301-4cef-84a0-63cc6a895330';

-- 1b. Clean the orders table
UPDATE orders 
SET 
  delivery_partner_invoice_id = NULL,
  receipt_received = false,
  receipt_received_at = NULL,
  receipt_received_by = NULL
WHERE id = 'b641440b-9346-427a-9e35-7f39f5da48f0';

-- ===== STEP 2: Fix returned order 117654262 in invoice 2662107 =====

-- 2a. Unlink from delivery_invoice_orders (set order_id to NULL)
UPDATE delivery_invoice_orders 
SET order_id = NULL
WHERE id = '4212ade9-d1c7-4924-8b1c-2c1f1c6e67a5';

-- 2b. Clean the orders table for returned order
UPDATE orders 
SET 
  delivery_partner_invoice_id = NULL,
  receipt_received = false,
  receipt_received_at = NULL,
  receipt_received_by = NULL
WHERE id = 'c592e13b-880b-4971-9431-061b66db29f8';

-- ===== STEP 3: Drop and recreate link_invoice_orders_to_orders with eligibility checks =====
DROP FUNCTION IF EXISTS public.link_invoice_orders_to_orders();

CREATE FUNCTION public.link_invoice_orders_to_orders()
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked_count INTEGER := 0;
  v_fixed_count INTEGER := 0;
  v_result RECORD;
BEGIN
  -- Step 1: Fix orders that are already linked in junction table but missing invoice_id in orders table
  -- CRITICAL: Only fix ELIGIBLE orders (not returned/rejected/cancelled)
  UPDATE orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND o.delivery_partner_invoice_id IS NULL
    AND dio.order_id IS NOT NULL
    -- ELIGIBILITY CHECK: Only link delivered/completed orders
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND (o.delivery_status IS NULL OR o.delivery_status NOT IN ('17', '12', '13', '14'));
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  
  -- Step 2: Link delivery_invoice_orders to orders table by matching tracking numbers
  -- CRITICAL: Only link ELIGIBLE orders
  UPDATE delivery_invoice_orders dio
  SET order_id = o.id
  FROM orders o
  WHERE dio.order_id IS NULL
    AND dio.external_order_id IS NOT NULL
    AND (
      o.tracking_number = dio.external_order_id
      OR o.delivery_partner_order_id = dio.external_order_id
    )
    -- ELIGIBILITY CHECK: Only link delivered/completed orders
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND (o.delivery_status IS NULL OR o.delivery_status NOT IN ('17', '12', '13', '14'));
  
  GET DIAGNOSTICS v_linked_count = ROW_COUNT;
  
  -- Step 3: Update orders.delivery_partner_invoice_id for newly linked orders
  -- CRITICAL: Only update ELIGIBLE orders
  UPDATE orders o
  SET delivery_partner_invoice_id = di.external_id
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND o.delivery_partner_invoice_id IS NULL
    -- ELIGIBILITY CHECK: Only link delivered/completed orders
    AND o.status NOT IN ('returned', 'returned_in_stock', 'rejected', 'cancelled')
    AND (o.delivery_status IS NULL OR o.delivery_status NOT IN ('17', '12', '13', '14'));
  
  SELECT v_fixed_count AS fixed_count, v_linked_count AS linked_count INTO v_result;
  RETURN v_result;
END;
$$;

-- ===== STEP 4: Drop and recreate reconcile_invoice_receipts with eligibility checks =====
DROP FUNCTION IF EXISTS public.reconcile_invoice_receipts();

CREATE FUNCTION public.reconcile_invoice_receipts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update receipt_received for orders linked to received invoices
  -- CRITICAL: Only mark ELIGIBLE orders as received (not returned/rejected/cancelled)
  UPDATE orders o
  SET 
    receipt_received = true,
    receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, now())
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON dio.invoice_id = di.id
  WHERE dio.order_id = o.id
    AND di.received = true
    AND o.receipt_received = false
    -- ELIGIBILITY CHECK: Only mark delivered/completed/partial_delivery as received
    AND o.status IN ('delivered', 'completed', 'partial_delivery')
    AND (o.delivery_status IS NULL OR o.delivery_status IN ('4', '5'));
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;

-- ===== STEP 5: Add comments to document the eligibility rules =====
COMMENT ON FUNCTION public.link_invoice_orders_to_orders() IS 
'Links delivery invoice orders to local orders. CRITICAL: Only links ELIGIBLE orders (delivered/completed). Returned, rejected, and cancelled orders are NEVER linked to prevent financial inflation.';

COMMENT ON FUNCTION public.reconcile_invoice_receipts() IS 
'Reconciles receipt status for orders linked to received invoices. CRITICAL: Only marks ELIGIBLE orders (delivered/completed/partial_delivery) as received. Returned, rejected, and cancelled orders are NEVER marked as received.';
