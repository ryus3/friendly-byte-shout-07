-- حذف الـ trigger المعطل
DROP TRIGGER IF EXISTS trigger_process_delivered_inventory ON orders;

-- حذف الدالة المعطلة
DROP FUNCTION IF EXISTS process_delivered_order_inventory();