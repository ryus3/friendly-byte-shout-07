-- إصلاح طلب ORD000808: إزالة settled_at الخاطئ وإلغاء الأرشفة
UPDATE profits 
SET settled_at = NULL 
WHERE order_id = '8caaa28a-004e-4e9c-a356-9f174c8384b0';

UPDATE orders 
SET isarchived = false 
WHERE id = '8caaa28a-004e-4e9c-a356-9f174c8384b0';