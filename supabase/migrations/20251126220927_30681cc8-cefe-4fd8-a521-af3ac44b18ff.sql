-- إلغاء الربط الخاطئ وتصحيح البيانات للطلب 112762972 والفاتورة 2479746

-- 1. حذف السجل الخاطئ من delivery_invoice_orders للطلب 112762972
DELETE FROM delivery_invoice_orders
WHERE order_id = (SELECT id FROM orders WHERE tracking_number = '112762972');

-- 2. إعادة delivery_partner_invoice_id إلى NULL للطلب 112762972
UPDATE orders
SET delivery_partner_invoice_id = NULL
WHERE tracking_number = '112762972';

-- 3. تصحيح final_amount للطلب 112762972
-- sales_amount = total_amount = 26,000
-- final_amount = total_amount + delivery_fee = 26,000 + 5,000 = 31,000
UPDATE orders
SET 
  sales_amount = 26000,
  final_amount = 31000
WHERE tracking_number = '112762972';

-- 4. إعادة orders_count للفاتورة 2479746 من 4 إلى 3
UPDATE delivery_invoices
SET orders_count = 3
WHERE external_id = '2479746';

-- التحقق من الإصلاحات
DO $$
DECLARE
  v_order_record RECORD;
  v_invoice_record RECORD;
  v_linked_orders_count INTEGER;
BEGIN
  -- التحقق من الطلب 112762972
  SELECT tracking_number, delivery_status, sales_amount, final_amount, delivery_partner_invoice_id
  INTO v_order_record
  FROM orders
  WHERE tracking_number = '112762972';
  
  RAISE NOTICE '=== الطلب 112762972 بعد الإصلاح ===';
  RAISE NOTICE 'delivery_status: %', v_order_record.delivery_status;
  RAISE NOTICE 'sales_amount: %', v_order_record.sales_amount;
  RAISE NOTICE 'final_amount: %', v_order_record.final_amount;
  RAISE NOTICE 'delivery_partner_invoice_id: %', COALESCE(v_order_record.delivery_partner_invoice_id, 'NULL (صحيح)');
  
  -- التحقق من الفاتورة 2479746
  SELECT external_id, orders_count, amount
  INTO v_invoice_record
  FROM delivery_invoices
  WHERE external_id = '2479746';
  
  -- عد الطلبات المرتبطة فعلياً
  SELECT COUNT(*)
  INTO v_linked_orders_count
  FROM delivery_invoice_orders
  WHERE invoice_id = (SELECT id FROM delivery_invoices WHERE external_id = '2479746');
  
  RAISE NOTICE '';
  RAISE NOTICE '=== الفاتورة 2479746 بعد الإصلاح ===';
  RAISE NOTICE 'orders_count في الجدول: %', v_invoice_record.orders_count;
  RAISE NOTICE 'عدد الطلبات المرتبطة فعلياً: %', v_linked_orders_count;
  RAISE NOTICE 'مبلغ الفاتورة: %', v_invoice_record.amount;
  
  IF v_invoice_record.orders_count = v_linked_orders_count THEN
    RAISE NOTICE '✅ orders_count متطابق مع العدد الفعلي';
  ELSE
    RAISE WARNING '❌ orders_count غير متطابق!';
  END IF;
END $$;