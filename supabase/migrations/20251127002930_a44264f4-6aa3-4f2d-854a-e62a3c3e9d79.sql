-- Migration: Fix double discount bug in order calculation functions
-- Description: Remove discount subtraction from validate_order_calculations and recalculate_order_totals
-- Root Cause: Migration 20251123002904 incorrectly added discount subtraction causing double discount
-- This restores the system to work as it did before November 23rd

-- ============================================================================
-- PHASE 1: Fix validate_order_calculations() function
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_order_calculations()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
BEGIN
  -- CRITICAL RULE: discount is for DISPLAY ONLY - never subtract it from calculations
  -- total_amount already includes any discount from delivery company
  
  -- ✅ CORRECT: sales_amount = total_amount (no discount subtraction)
  NEW.sales_amount := COALESCE(NEW.total_amount, 0);
  
  -- ✅ CORRECT: final_amount = total_amount + delivery_fee (no discount subtraction)
  NEW.final_amount := COALESCE(NEW.total_amount, 0) + COALESCE(NEW.delivery_fee, 0);
  
  -- Ensure non-negative values
  NEW.sales_amount := GREATEST(0, NEW.sales_amount);
  NEW.final_amount := GREATEST(0, NEW.final_amount);
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION validate_order_calculations() IS 
'✅ FIXED: Validates order calculations WITHOUT subtracting discount. Discount field is for display only. Rule: sales_amount = total_amount, final_amount = total_amount + delivery_fee';

-- ============================================================================
-- PHASE 2: Fix recalculate_order_totals() function
-- ============================================================================
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  items_total NUMERIC;
  order_delivery_fee NUMERIC;
  order_discount NUMERIC;
  correct_sales NUMERIC;
  correct_final NUMERIC;
BEGIN
  -- Get order totals
  SELECT 
    COALESCE(SUM(oi.total_price), 0),
    COALESCE(o.delivery_fee, 0),
    COALESCE(o.discount, 0)
  INTO items_total, order_delivery_fee, order_discount
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.id = COALESCE(NEW.order_id, OLD.order_id)
  GROUP BY o.delivery_fee, o.discount;

  -- CRITICAL RULE: discount is for DISPLAY ONLY - never subtract it from calculations
  -- ✅ CORRECT: sales_amount = total_amount (which equals items_total after delivery company adjustments)
  correct_sales := GREATEST(0, items_total);
  
  -- ✅ CORRECT: final_amount = total_amount + delivery_fee (no discount subtraction)
  correct_final := GREATEST(0, items_total + order_delivery_fee);

  -- Update order if values differ
  UPDATE orders
  SET 
    sales_amount = correct_sales,
    final_amount = correct_final,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id)
    AND (sales_amount != correct_sales OR final_amount != correct_final);

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION recalculate_order_totals() IS 
'✅ FIXED: Recalculates order totals WITHOUT subtracting discount. Discount field is for display only. Rule: sales_amount = items_total, final_amount = items_total + delivery_fee';

-- ============================================================================
-- PHASE 3: Correct historical data for affected orders
-- ============================================================================

-- Temporarily disable triggers to prevent re-calculation during correction
ALTER TABLE orders DISABLE TRIGGER validate_order_calculations_trigger;

-- Fix order 112762972 and any other orders with double discount issue
-- Criteria: orders where final_amount != total_amount + delivery_fee (indicating discount was subtracted)
WITH affected_orders AS (
  SELECT 
    id,
    order_number,
    tracking_number,
    total_amount,
    delivery_fee,
    discount,
    sales_amount as old_sales_amount,
    final_amount as old_final_amount,
    total_amount as correct_sales_amount,
    total_amount + delivery_fee as correct_final_amount
  FROM orders
  WHERE 
    -- Find orders where final_amount doesn't match expected calculation
    final_amount != total_amount + delivery_fee
    AND total_amount > 0
    AND status NOT IN ('cancelled', 'returned_in_stock')
)
UPDATE orders
SET 
  sales_amount = affected_orders.correct_sales_amount,
  final_amount = affected_orders.correct_final_amount,
  updated_at = NOW()
FROM affected_orders
WHERE orders.id = affected_orders.id;

-- Re-enable trigger
ALTER TABLE orders ENABLE TRIGGER validate_order_calculations_trigger;

-- ============================================================================
-- PHASE 4: Add future protection with CHECK constraint
-- ============================================================================

-- Add constraint to prevent final_amount from being less than total_amount + delivery_fee
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_final_amount_min_check'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_final_amount_min_check 
    CHECK (final_amount >= total_amount + delivery_fee);
  END IF;
END $$;

COMMENT ON CONSTRAINT orders_final_amount_min_check ON orders IS 
'Prevents double discount bug: final_amount must always be >= total_amount + delivery_fee';

-- ============================================================================
-- VERIFICATION: Log affected orders for audit
-- ============================================================================

DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM orders
  WHERE sales_amount = total_amount 
    AND final_amount = total_amount + delivery_fee
    AND status NOT IN ('cancelled', 'returned_in_stock')
    AND total_amount > 0;
    
  RAISE NOTICE '✅ Migration complete: % orders verified with correct calculations', affected_count;
END $$;