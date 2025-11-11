-- تعطيل Triggers الخاطئة التي تحرر المخزون بشكل خاطئ
DROP TRIGGER IF EXISTS auto_inventory_cleanup ON orders;
DROP TRIGGER IF EXISTS auto_inventory_cleanup_on_item_delete ON order_items;

-- إضافة تعليق على الدالة
COMMENT ON FUNCTION auto_cleanup_orphaned_reserved_stock() IS 'معطلة - تستخدم يدوياً فقط عند الحاجة. كانت تحرر المخزون بشكل خاطئ للطلبات غير pending';