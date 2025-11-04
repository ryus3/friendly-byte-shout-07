-- ============================================
-- المرحلة 1: دالة ربط الفواتير بالطلبات تلقائياً
-- ============================================
-- هذه الدالة تربط delivery_invoice_orders مع orders باستخدام:
-- 1. external_order_id -> tracking_number
-- 2. qr_id من raw -> tracking_number
-- 3. external_order_id -> delivery_partner_order_id

CREATE OR REPLACE FUNCTION link_invoice_orders_to_orders()
RETURNS TABLE(
  linked_count INTEGER,
  updated_orders_count INTEGER,
  processing_time_ms INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_linked_count INTEGER := 0;
  v_updated_orders INTEGER := 0;
  v_processing_ms INTEGER;
  v_invoice_order RECORD;
  v_matching_order RECORD;
  v_qr_id TEXT;
BEGIN
  v_start_time := clock_timestamp();
  
  -- معالجة جميع سجلات delivery_invoice_orders التي لم تُربط بعد
  FOR v_invoice_order IN 
    SELECT 
      dio.id as dio_id,
      dio.external_order_id,
      dio.raw,
      dio.invoice_id
    FROM delivery_invoice_orders dio
    WHERE dio.order_id IS NULL
    LIMIT 500 -- معالجة دفعة واحدة لتجنب الحمل الزائد
  LOOP
    v_matching_order := NULL;
    v_qr_id := NULL;
    
    -- محاولة استخراج qr_id من raw إذا كان موجوداً
    BEGIN
      v_qr_id := (v_invoice_order.raw->>'qr_id')::TEXT;
    EXCEPTION WHEN OTHERS THEN
      v_qr_id := NULL;
    END;
    
    -- البحث عن الطلب المطابق باستخدام عدة معايير
    -- 1. البحث بـ external_order_id -> tracking_number
    IF v_invoice_order.external_order_id IS NOT NULL THEN
      SELECT o.id, o.tracking_number
      INTO v_matching_order
      FROM orders o
      WHERE o.tracking_number = v_invoice_order.external_order_id
      LIMIT 1;
    END IF;
    
    -- 2. البحث بـ external_order_id -> delivery_partner_order_id
    IF v_matching_order IS NULL AND v_invoice_order.external_order_id IS NOT NULL THEN
      SELECT o.id, o.tracking_number
      INTO v_matching_order
      FROM orders o
      WHERE o.delivery_partner_order_id = v_invoice_order.external_order_id
      LIMIT 1;
    END IF;
    
    -- 3. البحث بـ qr_id -> tracking_number
    IF v_matching_order IS NULL AND v_qr_id IS NOT NULL THEN
      SELECT o.id, o.tracking_number
      INTO v_matching_order
      FROM orders o
      WHERE o.tracking_number = v_qr_id
      LIMIT 1;
    END IF;
    
    -- 4. البحث بـ qr_id -> delivery_partner_order_id
    IF v_matching_order IS NULL AND v_qr_id IS NOT NULL THEN
      SELECT o.id, o.tracking_number
      INTO v_matching_order
      FROM orders o
      WHERE o.delivery_partner_order_id = v_qr_id
      LIMIT 1;
    END IF;
    
    -- إذا وجدنا طلب مطابق، نقوم بالربط
    IF v_matching_order IS NOT NULL THEN
      -- تحديث delivery_invoice_orders
      UPDATE delivery_invoice_orders
      SET 
        order_id = v_matching_order.id,
        updated_at = NOW()
      WHERE id = v_invoice_order.dio_id;
      
      v_linked_count := v_linked_count + 1;
      
      -- تحديث الطلب في orders لإضافة معرف الفاتورة
      UPDATE orders
      SET 
        delivery_partner_invoice_id = (
          SELECT di.external_id
          FROM delivery_invoices di
          WHERE di.id = v_invoice_order.invoice_id
        ),
        updated_at = NOW()
      WHERE id = v_matching_order.id
      AND (delivery_partner_invoice_id IS NULL OR delivery_partner_invoice_id = '');
      
      IF FOUND THEN
        v_updated_orders := v_updated_orders + 1;
      END IF;
    END IF;
  END LOOP;
  
  -- حساب وقت المعالجة
  v_processing_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INTEGER;
  
  -- إرجاع النتائج
  RETURN QUERY SELECT v_linked_count, v_updated_orders, v_processing_ms;
END;
$$;

-- إضافة تعليق توضيحي
COMMENT ON FUNCTION link_invoice_orders_to_orders() IS 
'دالة تلقائية لربط طلبات الفواتير (delivery_invoice_orders) مع الطلبات (orders) باستخدام external_order_id و qr_id. تُستخدم في المزامنة التلقائية لضمان تحديث receipt_received بشكل صحيح.';