
-- ==========================================
-- إلغاء التعديل الفاشل واستعادة النظام القديم
-- ==========================================

-- 1. حذف الـ Trigger الجديد
DROP TRIGGER IF EXISTS on_purchase_insert_create_movement ON purchases;

-- 2. حذف الـ Functions الجديدة
DROP FUNCTION IF EXISTS auto_create_purchase_cash_movement();
DROP FUNCTION IF EXISTS recalculate_all_cash_movements();

-- 3. حذف أي حركات تم إنشاؤها بواسطة النظام الجديد بعد المايجريشن
-- (الحركات التي reference_type = 'purchase' وتم إنشاؤها بعد 2025-10-12 11:00:00)
DELETE FROM cash_movements 
WHERE reference_type = 'purchase'
AND created_at > '2025-10-12 11:00:00'::timestamptz;

-- 4. إعادة ضبط رصيد القاصة الرئيسية إلى القيمة الصحيحة
-- سنحسبها من مجموع جميع الحركات الموجودة
UPDATE cash_sources cs
SET current_balance = (
  SELECT 
    cs.initial_balance + COALESCE(SUM(
      CASE 
        WHEN cm.movement_type = 'in' THEN cm.amount
        WHEN cm.movement_type = 'out' THEN -cm.amount
        ELSE 0
      END
    ), 0)
  FROM cash_movements cm
  WHERE cm.cash_source_id = cs.id
),
updated_at = now()
WHERE cs.name = 'القاصة الرئيسية';

-- 5. إعادة حساب balance_before و balance_after لجميع الحركات بالترتيب الصحيح
-- نستخدم Window Function لحساب الرصيد المتراكم
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

-- 6. تسجيل عملية الاستعادة
COMMENT ON TABLE cash_movements IS 'تم استعادة النظام القديم وإلغاء التعديل الفاشل في 2025-10-12';
