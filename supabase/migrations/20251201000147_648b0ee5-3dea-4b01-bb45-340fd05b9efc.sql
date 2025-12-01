-- تعطيل trigger المكرر الذي ينشئ إشعارات order_status_changed
-- السبب: AlWaseetContext.jsx ينشئ إشعارات order_status_update بشكل صحيح
-- هذا الـ trigger يسبب إشعارات مكررة مع أيقونة مربعة غير احترافية

DROP TRIGGER IF EXISTS trg_send_order_notifications ON orders;

-- إضافة تعليق على الدالة للتوضيح (الدالة تبقى للاستخدام اليدوي إذا لزم)
COMMENT ON FUNCTION send_order_notifications() IS 'معطلة - AlWaseetContext.jsx يتعامل مع الإشعارات تلقائياً';