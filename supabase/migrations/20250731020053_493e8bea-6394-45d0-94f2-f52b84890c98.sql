-- إزالة حركة المصروف المحذوف من القاصة الرئيسية (4000 د.ع)
-- البحث عن الحركة وحذفها
DELETE FROM cash_movements 
WHERE description = 'مصروف: احمد' 
AND amount = 4000 
AND movement_type = 'out';

-- تحديث رصيد القاصة الرئيسية لإزالة الأثر
-- أولاً نحسب الرصيد الصحيح
UPDATE cash_sources 
SET current_balance = current_balance + 4000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- إضافة تسجيل حركة تصحيحية للتوضيح
INSERT INTO cash_movements (
  cash_source_id,
  amount,
  movement_type,
  reference_type,
  description,
  balance_before,
  balance_after,
  created_by
) 
SELECT 
  cs.id,
  4000,
  'in',
  'correction',
  'تصحيح: إزالة حركة مصروف محذوف (مصروف: احمد)',
  cs.current_balance - 4000,
  cs.current_balance,
  '91484496-b887-44f7-9e5d-be9db5567604'
FROM cash_sources cs 
WHERE cs.name = 'القاصة الرئيسية';