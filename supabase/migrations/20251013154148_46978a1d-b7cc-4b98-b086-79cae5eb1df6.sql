-- حذف سجل الأرباح المرتبط بالطلب الخاطئ
DELETE FROM profits 
WHERE order_id = '797889af-dc2c-4f15-a512-5fa8098062dc';

-- حذف الطلب الخاطئ 107280004 (ORD000070)
DELETE FROM orders 
WHERE id = '797889af-dc2c-4f15-a512-5fa8098062dc'
  AND tracking_number = '107280004'
  AND order_number = 'ORD000070';