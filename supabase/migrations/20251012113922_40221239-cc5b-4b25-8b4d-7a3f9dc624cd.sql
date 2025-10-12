-- حذف الحركات الثلاث الخاطئة المتعلقة بفاتورة رقم 1
DELETE FROM cash_movements 
WHERE id IN (
  '54a22ec1-1b7b-4c52-8bfd-845dac6a8b69',
  '94c5aad2-75f5-4383-8049-747b7e439516',
  '9a738ddd-a9bf-47b8-a602-9a28e956c9f8'
);

-- إعادة حساب balance_before و balance_after لجميع الحركات بالترتيب الصحيح
WITH ordered_movements AS (
  SELECT 
    cm.id,
    cm.cash_source_id,
    cm.movement_type,
    cm.amount,
    cm.effective_at,
    cs.initial_balance,
    ROW_NUMBER() OVER (
      PARTITION BY cm.cash_source_id 
      ORDER BY cm.effective_at, cm.created_at
    ) as row_num
  FROM cash_movements cm
  JOIN cash_sources cs ON cm.cash_source_id = cs.id
),
calculated_balances AS (
  SELECT 
    id,
    cash_source_id,
    initial_balance + SUM(
      CASE 
        WHEN movement_type = 'in' THEN amount
        WHEN movement_type = 'out' THEN -amount
        ELSE 0
      END
    ) OVER (
      PARTITION BY cash_source_id 
      ORDER BY row_num
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as balance_after,
    initial_balance + COALESCE(SUM(
      CASE 
        WHEN movement_type = 'in' THEN amount
        WHEN movement_type = 'out' THEN -amount
        ELSE 0
      END
    ) OVER (
      PARTITION BY cash_source_id 
      ORDER BY row_num
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) as balance_before
  FROM ordered_movements
)
UPDATE cash_movements cm
SET 
  balance_before = cb.balance_before,
  balance_after = cb.balance_after
FROM calculated_balances cb
WHERE cm.id = cb.id;

-- تحديث رصيد القاصة الرئيسية ليطابق آخر حركة
UPDATE cash_sources cs
SET current_balance = (
  SELECT cm.balance_after
  FROM cash_movements cm
  WHERE cm.cash_source_id = cs.id
  ORDER BY cm.effective_at DESC, cm.created_at DESC
  LIMIT 1
),
updated_at = now()
WHERE cs.name = 'القاصة الرئيسية';