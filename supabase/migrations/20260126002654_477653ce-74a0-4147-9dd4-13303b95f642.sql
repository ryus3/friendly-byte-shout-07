
-- الآن بعد إصلاح الـ trigger، نُنشئ سجل الربط للفاتورة #2755486

INSERT INTO delivery_invoice_orders (
  invoice_id,
  external_order_id,
  order_id,
  owner_user_id,
  amount,
  status,
  raw
) VALUES (
  '897c29ad-0d4f-4df4-ae23-a9e1422c3ca9',
  '122297290',
  '0c05bf36-f5f8-40db-a78e-7c4f59bc57d1',
  '91484496-b887-44f7-9e5d-be9db5567604',
  28000,
  'delivered',
  '{"id": 122297290, "manual_link": true, "source": "admin_fix"}'::jsonb
)
ON CONFLICT (invoice_id, external_order_id) DO NOTHING;
