
-- ======================================================================
-- إصلاح جذري: ربط الفواتير الثلاث بالطلبات المحلية
-- تعطيل الـ triggers المحددة بالاسم فقط (ليس ALL)
-- ======================================================================

-- 1️⃣ تعطيل الـ triggers المحددة على delivery_invoice_orders
ALTER TABLE delivery_invoice_orders DISABLE TRIGGER trg_auto_link_dio_to_order;
ALTER TABLE delivery_invoice_orders DISABLE TRIGGER auto_sync_order_receipt_on_link;
ALTER TABLE delivery_invoice_orders DISABLE TRIGGER auto_sync_delivery_partner_invoice_id;
ALTER TABLE delivery_invoice_orders DISABLE TRIGGER trg_delivery_invoice_orders_updated_at;
ALTER TABLE delivery_invoice_orders DISABLE TRIGGER trg_dio_set_updated_at;

-- 2️⃣ تعطيل الـ triggers ذات الصلة على orders
ALTER TABLE orders DISABLE TRIGGER record_order_revenue_on_receipt;
ALTER TABLE orders DISABLE TRIGGER trigger_sync_profit_status_with_receipt;
ALTER TABLE orders DISABLE TRIGGER sync_profit_status_trigger;

-- 3️⃣ إدراج طلبات الفاتورة 2686656 (6 طلبات)
INSERT INTO delivery_invoice_orders (invoice_id, external_order_id, order_id, owner_user_id, amount, raw)
SELECT 
  di.id,
  o.tracking_number,
  o.id,
  di.owner_user_id,
  o.total_amount,
  jsonb_build_object('id', o.tracking_number, 'linked_from_repair', true)
FROM orders o
CROSS JOIN delivery_invoices di
WHERE di.external_id = '2686656'
  AND o.tracking_number IN ('120755197', '120780807', '120867519', '120935591', '120935594', '120865441')
ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  updated_at = now();

-- 4️⃣ إدراج طلبات الفاتورة 2618773 (9 طلبات)
INSERT INTO delivery_invoice_orders (invoice_id, external_order_id, order_id, owner_user_id, amount, raw)
SELECT 
  di.id,
  o.tracking_number,
  o.id,
  di.owner_user_id,
  o.total_amount,
  jsonb_build_object('id', o.tracking_number, 'linked_from_repair', true)
FROM orders o
CROSS JOIN delivery_invoices di
WHERE di.external_id = '2618773'
  AND o.tracking_number IN ('119578405', '119597816', '119615119', '119615253', '119627571', '119643405', '119660399', '119660491', '119669697')
ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  updated_at = now();

-- 5️⃣ إدراج طلبات الفاتورة 2662107
INSERT INTO delivery_invoice_orders (invoice_id, external_order_id, order_id, owner_user_id, amount, raw)
SELECT 
  di.id,
  o.tracking_number,
  o.id,
  di.owner_user_id,
  o.total_amount,
  jsonb_build_object('id', o.tracking_number, 'linked_from_repair', true)
FROM orders o
JOIN delivery_invoices di ON di.owner_user_id = o.created_by
WHERE di.external_id = '2662107'
  AND o.tracking_number IS NOT NULL
  AND o.tracking_number != ''
  AND o.delivery_partner_order_id IS NOT NULL
  AND o.created_at BETWEEN (di.issued_at - interval '30 days') AND (di.issued_at + interval '7 days')
ON CONFLICT (invoice_id, external_order_id) DO UPDATE SET
  order_id = EXCLUDED.order_id,
  updated_at = now();

-- 6️⃣ تحديث delivery_partner_invoice_id في جدول orders
UPDATE orders o
SET 
  delivery_partner_invoice_id = di.external_id
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON di.id = dio.invoice_id
WHERE o.id = dio.order_id
  AND di.external_id IN ('2686656', '2618773', '2662107')
  AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id != di.external_id);

-- 7️⃣ تحديث receipt_received مع receipt_received_by
UPDATE orders o
SET 
  receipt_received = true,
  receipt_received_at = COALESCE(o.receipt_received_at, di.received_at, now()),
  receipt_received_by = COALESCE(o.receipt_received_by, di.owner_user_id)
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON di.id = dio.invoice_id
WHERE o.id = dio.order_id
  AND di.external_id IN ('2686656', '2618773', '2662107')
  AND di.received = true
  AND (o.receipt_received = false OR o.receipt_received IS NULL);

-- 8️⃣ التأكد من أن الفواتير الثلاث محددة كمستلمة
UPDATE delivery_invoices
SET 
  received = true,
  received_flag = true,
  status_normalized = 'received',
  received_at = COALESCE(received_at, now())
WHERE external_id IN ('2686656', '2618773', '2662107')
  AND received = false;

-- 9️⃣ إعادة تفعيل الـ triggers على orders
ALTER TABLE orders ENABLE TRIGGER record_order_revenue_on_receipt;
ALTER TABLE orders ENABLE TRIGGER trigger_sync_profit_status_with_receipt;
ALTER TABLE orders ENABLE TRIGGER sync_profit_status_trigger;

-- 🔟 إعادة تفعيل الـ triggers على delivery_invoice_orders
ALTER TABLE delivery_invoice_orders ENABLE TRIGGER trg_auto_link_dio_to_order;
ALTER TABLE delivery_invoice_orders ENABLE TRIGGER auto_sync_order_receipt_on_link;
ALTER TABLE delivery_invoice_orders ENABLE TRIGGER auto_sync_delivery_partner_invoice_id;
ALTER TABLE delivery_invoice_orders ENABLE TRIGGER trg_delivery_invoice_orders_updated_at;
ALTER TABLE delivery_invoice_orders ENABLE TRIGGER trg_dio_set_updated_at;
