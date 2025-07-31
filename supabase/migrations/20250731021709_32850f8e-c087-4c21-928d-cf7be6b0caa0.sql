-- تصحيح رصيد القاصة الرئيسية وإزالة الحركات الخاطئة
WITH main_cash AS (
  SELECT id FROM cash_sources WHERE name = 'القاصة الرئيسية'
),
-- حساب الرصيد الصحيح من الحركات الموجودة
correct_balance AS (
  SELECT 
    mc.id as cash_source_id,
    5000000 + -- رأس المال الأولي
    COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount
        WHEN cm.movement_type = 'out' THEN -cm.amount
        ELSE 0
      END
    ), 0) as calculated_balance
  FROM main_cash mc
  LEFT JOIN cash_movements cm ON mc.id = cm.cash_source_id
  WHERE cm.created_at IS NOT NULL
  GROUP BY mc.id
)
-- تحديث الرصيد المصحح
UPDATE cash_sources 
SET 
  current_balance = (SELECT calculated_balance FROM correct_balance WHERE cash_source_id = cash_sources.id),
  updated_at = now()
WHERE id = (SELECT id FROM main_cash);

-- إضافة تقرير للتحقق من الرصيد
SELECT 
  cs.name,
  cs.current_balance as "الرصيد المحدث",
  (
    SELECT COUNT(*) 
    FROM cash_movements cm 
    WHERE cm.cash_source_id = cs.id
  ) as "عدد الحركات",
  (
    SELECT 5000000 + COALESCE(SUM(
      CASE 
        WHEN movement_type = 'in' THEN amount
        WHEN movement_type = 'out' THEN -amount
        ELSE 0
      END
    ), 0)
    FROM cash_movements cm2
    WHERE cm2.cash_source_id = cs.id
  ) as "الرصيد المحسوب من الحركات"
FROM cash_sources cs
WHERE cs.name = 'القاصة الرئيسية';