-- إصلاح القاصة الرئيسية
-- حذف جميع الحركات السالبة بعد 10/10/2025 وإعادة ضبط الرصيد الصحيح

-- 1. حذف جميع حركات السحب (withdrawal) بعد 10/10/2025
DELETE FROM cash_movements
WHERE created_at > '2025-10-10 23:59:59'
  AND movement_type = 'withdrawal';

-- 2. إعادة ضبط رصيد القاصة الرئيسية إلى الرصيد الصحيح
UPDATE cash_sources
SET current_balance = 5215000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';