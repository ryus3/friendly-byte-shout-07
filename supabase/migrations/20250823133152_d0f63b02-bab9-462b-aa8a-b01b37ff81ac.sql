-- إصلاح بيانات الأرباح للطلب RYUS-415487
-- تحديث settled_at لسجل الربح الذي تم تسويته
UPDATE profits 
SET settled_at = CASE 
  WHEN status = 'settled' AND settled_at IS NULL THEN created_at
  ELSE settled_at
END,
updated_at = now()
WHERE status = 'settled' AND settled_at IS NULL;