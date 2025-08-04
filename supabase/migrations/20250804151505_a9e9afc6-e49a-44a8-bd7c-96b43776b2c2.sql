-- تنظيف شامل وإعادة بناء القاصة الرئيسية من الصفر
-- الخطوة 1: تنظيف جميع الحركات المعطوبة والاحتفاظ بالصحيحة فقط

-- إنشاء جدول مؤقت للحركات الصحيحة المؤكدة
CREATE TEMP TABLE temp_valid_movements AS
SELECT cm.*
FROM cash_movements cm
JOIN cash_sources cs ON cm.cash_source_id = cs.id
WHERE cs.name = 'القاصة الرئيسية'
AND (
  -- المبيعات المؤكدة
  (cm.reference_type = 'order_revenue' AND EXISTS(
    SELECT 1 FROM orders o 
    WHERE o.id = cm.reference_id 
    AND o.status IN ('completed', 'delivered') 
    AND o.receipt_received = true
  ))
  OR
  -- مستحقات الموظفين المؤكدة
  (cm.reference_type = 'employee_dues' AND EXISTS(
    SELECT 1 FROM expenses e 
    WHERE e.category = 'مستحقات الموظفين' 
    AND e.expense_type = 'system' 
    AND e.status = 'approved'
  ))
);

-- حذف جميع الحركات النقدية للقاصة الرئيسية
DELETE FROM cash_movements 
WHERE cash_source_id = (SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية');

-- إعادة إدراج الحركات الصحيحة فقط
INSERT INTO cash_movements (
  id, cash_source_id, amount, movement_type, reference_type, 
  reference_id, description, balance_before, balance_after, 
  created_by, created_at
)
SELECT 
  id, cash_source_id, amount, movement_type, reference_type,
  reference_id, description, balance_before, balance_after,
  created_by, created_at
FROM temp_valid_movements
ORDER BY created_at;

-- الخطوة 2: إعادة حساب الرصيد الصحيح
DO $$
DECLARE
  main_cash_id UUID;
  correct_balance NUMERIC := 5000000; -- رأس المال الأساسي
  movement_record RECORD;
BEGIN
  -- الحصول على معرف القاصة الرئيسية
  SELECT id INTO main_cash_id FROM cash_sources WHERE name = 'القاصة الرئيسية';
  
  -- إعادة حساب الأرصدة التدريجية
  FOR movement_record IN 
    SELECT * FROM cash_movements 
    WHERE cash_source_id = main_cash_id 
    ORDER BY created_at ASC
  LOOP
    UPDATE cash_movements 
    SET 
      balance_before = correct_balance,
      balance_after = correct_balance + 
        CASE WHEN movement_type = 'in' THEN amount ELSE -amount END
    WHERE id = movement_record.id;
    
    -- تحديث الرصيد للحركة التالية
    correct_balance := correct_balance + 
      CASE WHEN movement_record.movement_type = 'in' THEN movement_record.amount ELSE -movement_record.amount END;
  END LOOP;
  
  -- تحديث رصيد القاصة النهائي
  UPDATE cash_sources 
  SET current_balance = correct_balance, updated_at = now()
  WHERE id = main_cash_id;
  
  RAISE NOTICE 'تم تنظيف وإعادة بناء النظام المالي. الرصيد النهائي: %', correct_balance;
END;
$$;