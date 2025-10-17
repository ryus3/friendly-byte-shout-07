-- إزالة Trigger المعطوب الذي يعرض رسائل خطأ معكوسة
DROP TRIGGER IF EXISTS check_order_amounts ON orders;
DROP FUNCTION IF EXISTS validate_order_amounts();