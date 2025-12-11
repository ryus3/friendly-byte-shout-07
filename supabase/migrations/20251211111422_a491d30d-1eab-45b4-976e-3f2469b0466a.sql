-- حذف النسخة الخاطئة من release_stock_item التي تؤثر على quantity و sold_quantity
DROP FUNCTION IF EXISTS release_stock_item(uuid, uuid, integer);

-- إصلاح البيانات المتضررة للمنتج سوت شيك سمائي S
UPDATE inventory 
SET quantity = 1, reserved_quantity = 0, sold_quantity = 0
WHERE variant_id = '82a9b190-8a0f-4896-b0a6-019bb34747c9';