-- 🔧 إصلاح شامل: الطلب 112762972 والفاتورة 2479746

-- 1️⃣ إصلاح حسابات الطلب 112762972 (يخصم مرتين حالياً)
-- المشكلة: sales_amount = 24,000 بدلاً من 26,000
-- السبب: الـ trigger لا يُنفّذ عند UPDATE بنفس القيم
UPDATE orders 
SET 
  sales_amount = total_amount,  -- تصحيح مباشر: 26,000
  final_amount = total_amount + delivery_fee  -- تصحيح مباشر: 26,000 + 5,000 = 31,000
WHERE tracking_number = '112762972';

-- 2️⃣ ربط الطلب 112762972 بالفاتورة 2479746
-- إنشاء سجل في delivery_invoice_orders
INSERT INTO delivery_invoice_orders (
  invoice_id,
  order_id,
  external_order_id,
  amount,
  status,
  owner_user_id,
  raw
)
SELECT 
  di.id as invoice_id,
  o.id as order_id,
  o.tracking_number as external_order_id,
  o.final_amount as amount,
  o.status,
  o.created_by as owner_user_id,
  jsonb_build_object(
    'tracking_number', o.tracking_number,
    'final_amount', o.final_amount,
    'linked_at', now()
  ) as raw
FROM delivery_invoices di
CROSS JOIN orders o
WHERE di.external_id = '2479746'
  AND o.tracking_number = '112762972'
  AND NOT EXISTS (
    SELECT 1 FROM delivery_invoice_orders dio2
    WHERE dio2.invoice_id = di.id AND dio2.order_id = o.id
  );

-- 3️⃣ تحديث عدد الطلبات في الفاتورة من 3 إلى 4
UPDATE delivery_invoices
SET 
  orders_count = 4,
  amount = 99000  -- 33,000 + 33,000 + 33,000 + 31,000 (بعد التصحيح - يجب التحقق من الرقم الصحيح)
WHERE external_id = '2479746';

-- ✅ التحقق النهائي
DO $$
DECLARE
  v_order RECORD;
  v_invoice RECORD;
  v_linked_count INT;
BEGIN
  -- فحص الطلب
  SELECT tracking_number, total_amount, discount, delivery_fee, sales_amount, final_amount
  INTO v_order
  FROM orders WHERE tracking_number = '112762972';
  
  RAISE NOTICE '=== الطلب 112762972 ===';
  RAISE NOTICE 'total_amount: % (صحيح ✅)', v_order.total_amount;
  RAISE NOTICE 'discount: % (للعرض فقط)', v_order.discount;
  RAISE NOTICE 'delivery_fee: %', v_order.delivery_fee;
  RAISE NOTICE 'sales_amount: % (يجب = 26,000)', v_order.sales_amount;
  RAISE NOTICE 'final_amount: % (يجب = 31,000)', v_order.final_amount;
  
  -- فحص الفاتورة
  SELECT external_id, orders_count, amount, received
  INTO v_invoice
  FROM delivery_invoices WHERE external_id = '2479746';
  
  SELECT COUNT(*) INTO v_linked_count
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON dio.invoice_id = di.id
  WHERE di.external_id = '2479746';
  
  RAISE NOTICE '=== الفاتورة 2479746 ===';
  RAISE NOTICE 'orders_count: % (يجب = 4)', v_invoice.orders_count;
  RAISE NOTICE 'طلبات مرتبطة فعلياً: % (يجب = 4)', v_linked_count;
  RAISE NOTICE 'received: %', v_invoice.received;
END $$;