-- إنشاء الـ Trigger المفقود لإرسال الإشعارات عند تغيير حالة الطلب
-- هذا الـ trigger كان مفقوداً تماماً مما تسبب في توقف الإشعارات منذ 25/11

-- حذف الـ trigger إذا كان موجوداً (للتأكد)
DROP TRIGGER IF EXISTS trg_send_order_notifications ON orders;

-- إنشاء الـ trigger الذي يستدعي الدالة الموجودة
CREATE TRIGGER trg_send_order_notifications
  AFTER UPDATE OF status, delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_notifications();

-- تعليق توضيحي
COMMENT ON TRIGGER trg_send_order_notifications ON orders IS 
'يرسل إشعارات تلقائية عند تغيير حالة الطلب (status) أو حالة التوصيل (delivery_status). يتتبع القيم القديمة والجديدة للحالات.';