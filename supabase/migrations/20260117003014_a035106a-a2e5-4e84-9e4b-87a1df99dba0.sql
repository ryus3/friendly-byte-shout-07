-- إصلاح فاتورة 2618773: إزالة الطلب الخاطئ وربط الطلب الناقص

-- الخطوة 1: إزالة ربط الطلب 121313050 (ليس من الفاتورة)
UPDATE orders 
SET delivery_partner_invoice_id = NULL,
    receipt_received = false,
    receipt_received_by = NULL,
    receipt_received_at = NULL
WHERE tracking_number = '121313050'
  AND delivery_partner_invoice_id = '2618773';

-- الخطوة 2: ربط الطلب الناقص 120847733
UPDATE orders 
SET delivery_partner_invoice_id = '2618773',
    receipt_received = true,
    receipt_received_by = created_by,
    receipt_received_at = now()
WHERE tracking_number = '120847733'
  AND id = 'd663ff4b-059e-44f5-a757-bdf1ad7004f3';