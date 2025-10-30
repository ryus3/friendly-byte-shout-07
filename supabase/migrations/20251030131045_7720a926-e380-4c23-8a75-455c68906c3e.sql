-- تنظيف الحركات المالية الخاطئة من نظام الإرجاع
-- حذف الحركات السلبية الخاطئة التي تم إنشاؤها عند إنشاء طلبات الإرجاع (بدلاً من عند استلام البضاعة)

-- 1. حذف الحركات المالية الخاطئة
DELETE FROM cash_movements
WHERE movement_type = 'withdrawal'
  AND reference_type = 'order'
  AND description LIKE '%إرجاع للزبون%بانتظار الاستلام%'
  AND created_at >= '2024-10-21'
  AND created_at < '2024-10-25';

-- 2. إعادة حساب رصيد القاصة الرئيسية بناءً على الحركات الصحيحة
-- نجد القاصة الرئيسية ونعيد حساب رصيدها
WITH main_cash_source AS (
  SELECT id 
  FROM cash_sources 
  WHERE name = 'القاصة الرئيسية' 
  LIMIT 1
),
calculated_balance AS (
  SELECT 
    COALESCE(SUM(
      CASE 
        WHEN movement_type = 'deposit' THEN amount
        WHEN movement_type = 'withdrawal' THEN -amount
        ELSE 0
      END
    ), 0) as total_balance
  FROM cash_movements
  WHERE cash_source_id = (SELECT id FROM main_cash_source)
)
UPDATE cash_sources
SET current_balance = (SELECT total_balance FROM calculated_balance),
    updated_at = now()
WHERE id = (SELECT id FROM main_cash_source);