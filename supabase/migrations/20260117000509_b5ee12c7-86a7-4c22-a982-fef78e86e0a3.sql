
-- إصلاح فاتورة عبدالله 2618773: ربط 9 طلبات مسلّمة مع تعيين receipt_received_by
UPDATE orders 
SET delivery_partner_invoice_id = '2618773',
    receipt_received = true,
    receipt_received_by = created_by,
    receipt_received_at = now()
WHERE id IN (
  'b641440b-9346-427a-9e35-7f39f5da48f0',
  'a977efbd-8341-4698-956a-29bfd288533b',
  '3529f4d9-a108-4197-8540-2d9bcbc62534',
  '14dec386-591d-4745-84e9-e47d60992108',
  '50f26015-83a1-4db2-ac81-fc486a87f275',
  'cd34c778-e5f1-49e8-af2b-f01583ae3e50',
  '7104bb31-291c-48ea-a6cf-fc57bd98070c',
  'f9383581-bbc0-48fd-b209-7517f8244147',
  '2bcfbf51-010f-426f-9ed5-749b69bb7dea'
);

-- إصلاح فاتورة سارة 2662107: إزالة ربط الطلبات الراجعة
UPDATE orders 
SET delivery_partner_invoice_id = NULL,
    receipt_received = false
WHERE delivery_partner_invoice_id = '2662107'
  AND delivery_status = '17';
