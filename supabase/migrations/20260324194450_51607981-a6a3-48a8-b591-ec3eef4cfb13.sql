-- 1. حذف Trigger المكرر - الإبقاء على واحد فقط
DROP TRIGGER IF EXISTS trigger_expense_cash_movement ON expenses;

-- 2. تنظيف البيانات المكررة: حذف النسخة الثانية من "فيس"
DELETE FROM expenses WHERE id = '83fbe001-5fbd-4a38-9a2b-292690c8fcd7';

-- 3. تحديث المصروف المتبقي ليصبح approved (أُنشئ قبل الـ BEFORE trigger)
UPDATE expenses 
SET status = 'approved', 
    approved_at = now(), 
    approved_by = created_by 
WHERE id = '09d8ff96-47d0-49e3-8066-0780d1b21273' 
  AND status = 'pending';