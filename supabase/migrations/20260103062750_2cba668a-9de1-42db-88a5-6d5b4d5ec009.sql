
-- ============================================
-- Step 1: Update 81 orders with zero profit to no_rule_archived
-- ============================================
UPDATE profits
SET 
  status = 'no_rule_archived',
  settled_at = now(),
  updated_at = now()
WHERE employee_profit = 0 
  AND status = 'invoice_received';

-- ============================================
-- Step 2: Delete pending deduction for Sara (zero-profit order)
-- ============================================
DELETE FROM employee_pending_deductions
WHERE id = '12b9b9c1-6d67-426e-ad60-b08d3cad6800';

-- ============================================
-- Step 3: Fix sync_profit_status_with_receipt trigger
-- to auto-archive zero-profit orders on invoice receipt
-- ============================================
CREATE OR REPLACE FUNCTION sync_profit_status_with_receipt()
RETURNS trigger AS $$
BEGIN
  -- Only process if receipt_received changed
  IF OLD.receipt_received IS DISTINCT FROM NEW.receipt_received THEN
    UPDATE profits
    SET 
      status = CASE 
        -- If employee_profit = 0 AND receipt received → auto-archive immediately
        WHEN employee_profit = 0 AND NEW.receipt_received = true THEN 'no_rule_archived'
        -- If has employee profit → invoice_received (awaiting settlement)
        WHEN NEW.receipt_received = true THEN 'invoice_received'
        -- Otherwise pending
        ELSE 'pending'
      END,
      settled_at = CASE 
        WHEN employee_profit = 0 AND NEW.receipt_received = true THEN now()
        ELSE settled_at
      END,
      invoice_received_at = CASE
        WHEN NEW.receipt_received = true AND employee_profit > 0 THEN now()
        ELSE invoice_received_at
      END,
      updated_at = now()
    WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
