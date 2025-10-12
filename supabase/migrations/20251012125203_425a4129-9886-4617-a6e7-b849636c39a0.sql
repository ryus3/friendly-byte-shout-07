-- تصحيح الرصيد الحالي في cash_sources بناءً على آخر حركة نقدية
-- هذا يضمن تطابق current_balance مع balance_after من آخر cash_movement

UPDATE cash_sources cs
SET 
  current_balance = COALESCE(
    (
      SELECT balance_after
      FROM cash_movements cm
      WHERE cm.cash_source_id = cs.id
      ORDER BY cm.effective_at DESC, cm.created_at DESC
      LIMIT 1
    ),
    cs.initial_balance
  ),
  updated_at = now()
WHERE EXISTS (
  SELECT 1 
  FROM cash_movements 
  WHERE cash_source_id = cs.id
);

-- تسجيل التصحيحات
DO $$
DECLARE
  corrected_count INTEGER;
BEGIN
  GET DIAGNOSTICS corrected_count = ROW_COUNT;
  RAISE NOTICE 'تم تصحيح الرصيد لـ % مصدر نقدي', corrected_count;
END $$;