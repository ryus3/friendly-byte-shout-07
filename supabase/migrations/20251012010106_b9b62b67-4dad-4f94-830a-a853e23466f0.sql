-- حذف جميع triggers القديمة
DROP TRIGGER IF EXISTS add_loyalty_points_on_order_completion ON orders;
DROP TRIGGER IF EXISTS trigger_auto_complete_on_receipt ON orders;
DROP TRIGGER IF EXISTS sync_purchase_with_cash_movement ON purchases;
DROP TRIGGER IF EXISTS trigger_create_cash_movement_for_expense ON expenses;

-- 1. إكمال طلبات المدير
CREATE OR REPLACE FUNCTION auto_complete_manager_orders_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_received = true 
     AND COALESCE(OLD.receipt_received, false) = false 
     AND NEW.created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid
     AND NEW.status != 'completed' THEN
    UPDATE orders SET status = 'completed', updated_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER trigger_auto_complete_on_receipt
  AFTER UPDATE ON orders FOR EACH ROW
  EXECUTE FUNCTION auto_complete_manager_orders_on_receipt();

-- 2. حركات نقد منفصلة  
CREATE OR REPLACE FUNCTION create_cash_movement_for_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_cash_source_id UUID;
  v_balance_before NUMERIC;
  v_balance_after NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND NEW.metadata->>'purchase_reference_id' IS NOT NULL THEN
    SELECT cash_source_id INTO v_cash_source_id FROM purchases WHERE id = (NEW.metadata->>'purchase_reference_id')::UUID;
    IF v_cash_source_id IS NULL THEN RETURN NEW; END IF;
    
    SELECT current_balance INTO v_balance_before FROM cash_sources WHERE id = v_cash_source_id;
    v_balance_after := v_balance_before - NEW.amount;
    
    INSERT INTO cash_movements (cash_source_id, movement_type, amount, description, reference_type, reference_id,
      balance_before, balance_after, created_by, effective_at)
    VALUES (v_cash_source_id, 'out', NEW.amount, NEW.description, 'expense', NEW.id,
      v_balance_before, v_balance_after, NEW.created_by, NEW.created_at);
    
    UPDATE cash_sources SET current_balance = v_balance_after, updated_at = now() WHERE id = v_cash_source_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trigger_create_cash_movement_for_expense
  AFTER INSERT ON expenses FOR EACH ROW
  EXECUTE FUNCTION create_cash_movement_for_expense();

-- 3. تنظيف البيانات
DELETE FROM cash_movements WHERE reference_type = 'purchase' AND created_at >= '2025-10-11';

WITH expense_movements AS (
  SELECT e.id AS expense_id, e.amount, e.description, e.created_by, e.created_at, p.cash_source_id
  FROM expenses e
  JOIN purchases p ON p.id = (e.metadata->>'purchase_reference_id')::UUID
  WHERE e.status = 'approved' AND e.metadata->>'purchase_reference_id' IS NOT NULL 
    AND e.created_at >= '2025-10-11'
    AND NOT EXISTS (SELECT 1 FROM cash_movements cm WHERE cm.reference_type = 'expense' AND cm.reference_id = e.id)
)
INSERT INTO cash_movements (cash_source_id, movement_type, amount, description, reference_type, reference_id,
  balance_before, balance_after, created_by, effective_at)
SELECT em.cash_source_id, 'out', em.amount, em.description, 'expense', em.expense_id, 0, 0, em.created_by, em.created_at
FROM expense_movements em;

UPDATE cash_sources cs SET current_balance = (
  SELECT cs.initial_balance + COALESCE(SUM(
    CASE WHEN cm.movement_type = 'in' THEN cm.amount WHEN cm.movement_type = 'out' THEN -cm.amount ELSE 0 END), 0)
  FROM cash_movements cm WHERE cm.cash_source_id = cs.id
);

UPDATE orders SET status = 'completed', updated_at = now()
WHERE receipt_received = true AND status = 'delivered' 
  AND created_by = '91484496-b887-44f7-9e5d-be9db5567604'::uuid;

-- 4. Weighted Average Cost
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS weighted_avg_cost NUMERIC(15,2) DEFAULT 0;

CREATE OR REPLACE FUNCTION calculate_weighted_avg_cost(p_variant_id UUID) RETURNS NUMERIC AS $$
DECLARE v_avg_cost NUMERIC := 0;
BEGIN
  SELECT ROUND(COALESCE(SUM(unit_cost * quantity) / NULLIF(SUM(quantity), 0), 0), 0) INTO v_avg_cost
  FROM purchase_cost_history WHERE variant_id = p_variant_id AND created_at >= now() - interval '6 months';
  IF v_avg_cost = 0 THEN SELECT COALESCE(cost_price, 0) INTO v_avg_cost FROM product_variants WHERE id = p_variant_id; END IF;
  RETURN v_avg_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION update_weighted_avg_cost_on_purchase() RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_variants SET weighted_avg_cost = calculate_weighted_avg_cost(NEW.variant_id), updated_at = now() WHERE id = NEW.variant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_update_weighted_avg_cost ON purchase_cost_history;
CREATE TRIGGER trigger_update_weighted_avg_cost AFTER INSERT OR UPDATE ON purchase_cost_history 
  FOR EACH ROW EXECUTE FUNCTION update_weighted_avg_cost_on_purchase();

UPDATE product_variants SET weighted_avg_cost = calculate_weighted_avg_cost(id);

-- 5. دعم الدولار  
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'IQD',
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS currency_amount NUMERIC(15,2);