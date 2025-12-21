-- إصلاح شامل للبيانات + تحسين الـ trigger

-- 1️⃣ إرجاع الطلبات التي لها employee_profit > 0 من completed إلى delivered
UPDATE orders o
SET status = 'delivered', updated_at = NOW()
FROM profits p
WHERE p.order_id = o.id
  AND o.status = 'completed'
  AND p.status = 'invoice_received'
  AND p.employee_profit > 0;

-- 2️⃣ تحديث حالة الأرباح للطلبات بدون ربح موظف إلى no_rule_settled
UPDATE profits p
SET status = 'no_rule_settled', updated_at = NOW()
FROM orders o
WHERE p.order_id = o.id
  AND o.status = 'completed'
  AND p.status = 'invoice_received'
  AND p.employee_profit = 0;

-- 3️⃣ تحسين الـ trigger لتحديث حالة الأرباح تلقائياً عند التحويل لـ completed
CREATE OR REPLACE FUNCTION public.auto_complete_zero_profit_orders()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_profit NUMERIC;
BEGIN
  -- فقط عند استلام الإيصال
  IF NEW.receipt_received = true AND OLD.receipt_received IS DISTINCT FROM NEW.receipt_received THEN
    -- جلب ربح الموظف
    SELECT employee_profit INTO v_employee_profit
    FROM profits 
    WHERE order_id = NEW.id;
    
    -- إذا لم يكن هناك ربح للموظف، تحويل إلى completed وتحديث profit_status
    IF v_employee_profit IS NOT NULL AND v_employee_profit = 0 THEN
      NEW.status := 'completed';
      
      -- تحديث حالة الأرباح إلى no_rule_settled
      UPDATE profits 
      SET status = 'no_rule_settled', updated_at = NOW()
      WHERE order_id = NEW.id AND employee_profit = 0;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;