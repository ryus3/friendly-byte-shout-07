-- إزالة ربط الطلب 121313050 من الفاتورة 2618773
UPDATE orders 
SET delivery_partner_invoice_id = NULL,
    receipt_received = false,
    receipt_received_by = NULL,
    receipt_received_at = NULL
WHERE tracking_number = '121313050';