-- Fix sync_profit_status_with_receipt trigger - remove invoice_received_at reference
-- جدول profits لا يحتوي على عمود invoice_received_at

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
      -- ✅ تم إزالة invoice_received_at لأنه غير موجود في جدول profits
      updated_at = now()
    WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;