-- 🔧 إصلاح شامل: الربط التلقائي للطلبات بالفواتير

-- 1️⃣ إصلاح البيانات الفورية للطلب 112762972
UPDATE orders 
SET 
  sales_amount = 26000,
  final_amount = 31000,
  delivery_partner_invoice_id = '2479746'
WHERE tracking_number = '112762972';

-- 2️⃣ تحديث delivery_partner_invoice_id لباقي الطلبات في الفاتورة 2479746
UPDATE orders o
SET delivery_partner_invoice_id = '2479746'
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON dio.invoice_id = di.id
WHERE di.external_id = '2479746'
  AND dio.order_id = o.id
  AND o.delivery_partner_invoice_id IS NULL;

-- 3️⃣ إنشاء trigger للربط التلقائي
-- عند INSERT في delivery_invoice_orders، يحدث تحديث تلقائي لـ delivery_partner_invoice_id

CREATE OR REPLACE FUNCTION sync_delivery_partner_invoice_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_external_id TEXT;
BEGIN
  -- جلب external_id من الفاتورة
  SELECT external_id INTO v_invoice_external_id
  FROM delivery_invoices
  WHERE id = NEW.invoice_id;
  
  -- تحديث delivery_partner_invoice_id في الطلب
  UPDATE orders
  SET delivery_partner_invoice_id = v_invoice_external_id
  WHERE id = NEW.order_id
    AND (delivery_partner_invoice_id IS NULL OR delivery_partner_invoice_id != v_invoice_external_id);
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_delivery_partner_invoice_id() IS 
'تزامن تلقائي: عند ربط طلب بفاتورة في delivery_invoice_orders، يُحدّث delivery_partner_invoice_id تلقائياً';

-- إنشاء trigger على delivery_invoice_orders
DROP TRIGGER IF EXISTS auto_sync_delivery_partner_invoice_id ON delivery_invoice_orders;
CREATE TRIGGER auto_sync_delivery_partner_invoice_id
  AFTER INSERT ON delivery_invoice_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_delivery_partner_invoice_id();

-- 4️⃣ إصلاح جميع الطلبات المرتبطة الحالية التي تفتقد delivery_partner_invoice_id
UPDATE orders o
SET delivery_partner_invoice_id = di.external_id
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON dio.invoice_id = di.id
WHERE dio.order_id = o.id
  AND o.delivery_partner_invoice_id IS NULL;

-- ✅ التحقق النهائي
DO $$
DECLARE
  v_fixed_count INT;
  v_missing_count INT;
BEGIN
  -- عدد الطلبات المُصلّحة
  SELECT COUNT(*) INTO v_fixed_count
  FROM orders o
  JOIN delivery_invoice_orders dio ON dio.order_id = o.id
  JOIN delivery_invoices di ON dio.invoice_id = di.id
  WHERE o.delivery_partner_invoice_id = di.external_id;
  
  -- عدد الطلبات المفقودة
  SELECT COUNT(*) INTO v_missing_count
  FROM orders o
  JOIN delivery_invoice_orders dio ON dio.order_id = o.id
  WHERE o.delivery_partner_invoice_id IS NULL;
  
  RAISE NOTICE '=== التحقق النهائي ===';
  RAISE NOTICE 'طلبات مرتبطة بشكل صحيح: %', v_fixed_count;
  RAISE NOTICE 'طلبات مفقودة (يجب = 0): %', v_missing_count;
  
  -- فحص الطلب 112762972 بالتحديد
  PERFORM 1 FROM orders 
  WHERE tracking_number = '112762972' 
    AND final_amount = 31000 
    AND delivery_partner_invoice_id = '2479746';
  
  IF FOUND THEN
    RAISE NOTICE 'الطلب 112762972: تم الإصلاح بنجاح ✅';
  ELSE
    RAISE WARNING 'الطلب 112762972: فشل الإصلاح ⚠️';
  END IF;
END $$;