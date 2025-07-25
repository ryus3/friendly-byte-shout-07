-- تحديث حالة الطلب ORD000003 من return_received إلى returned_in_stock
UPDATE orders 
SET status = 'returned_in_stock', 
    updated_at = now()
WHERE order_number = 'ORD000003' AND status = 'return_received';