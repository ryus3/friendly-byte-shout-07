-- إعادة تفعيل trigger إشعارات تغيير حالة الطلب
-- هذا الـ trigger كان يعمل صحيحاً في 24/11 وتم حذفه خطأً

CREATE TRIGGER trg_send_order_notifications
  AFTER UPDATE OF status, delivery_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION send_order_notifications();

COMMENT ON TRIGGER trg_send_order_notifications ON orders IS 
'يرسل إشعارات تلقائية عند تغيير حالة الطلب - تم إعادة تفعيله في 2025-12-01';