-- إصلاح effective_at ليطابق created_at
UPDATE cash_movements
SET effective_at = created_at
WHERE effective_at != created_at;

-- توحيد movement_type من income/expense إلى in/out
UPDATE cash_movements
SET movement_type = CASE 
  WHEN movement_type = 'income' THEN 'in'
  WHEN movement_type = 'expense' THEN 'out'
  ELSE movement_type
END
WHERE movement_type IN ('income', 'expense');