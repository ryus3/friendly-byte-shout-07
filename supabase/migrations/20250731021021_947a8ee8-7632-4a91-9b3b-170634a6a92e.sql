-- حذف الحركة الخاطئة التي تم إنشاؤها للتصحيح وأصبحت مكررة
DELETE FROM cash_movements 
WHERE id = 'c0c85070-c4f5-4723-9a43-196a74003e7c' 
  AND amount = 4000 
  AND movement_type = 'in'
  AND description = 'تصحيح: إزالة حركة مصروف محذوف (مصروف: احمد)';

-- تصحيح رصيد القاصة الرئيسية لإزالة الـ 4000 الزائدة
UPDATE cash_sources 
SET current_balance = current_balance - 4000,
    updated_at = now()
WHERE name = 'القاصة الرئيسية';

-- إضافة إشعار للتصحيح
INSERT INTO notifications (
  title,
  message,
  type,
  priority,
  data,
  user_id
) VALUES (
  'تصحيح القاصة الرئيسية',
  'تم حذف حركة مكررة بقيمة 4000 دينار وتصحيح رصيد القاصة الرئيسية',
  'cash_correction',
  'medium',
  jsonb_build_object('amount', 4000, 'type', 'duplicate_removal'),
  NULL
);