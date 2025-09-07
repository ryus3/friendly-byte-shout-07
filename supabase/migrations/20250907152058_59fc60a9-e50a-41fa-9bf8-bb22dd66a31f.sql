-- تصحيح حالة الطلب ORD000005 وتطبيق آلية استلام الفاتورة
UPDATE public.orders 
SET 
  status = 'delivered',
  receipt_received = true,
  receipt_received_at = now(),
  receipt_received_by = 'fba59dfc-451c-4906-8882-ae4601ff34d4'::uuid,
  delivery_partner_invoice_id = 'LOCAL-ORD000005',
  updated_at = now()
WHERE id = '73e17a6f-85c7-4a1c-a793-d8f9303de037';