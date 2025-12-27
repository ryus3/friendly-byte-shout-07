-- إصلاح دالة link_invoice_orders_to_orders لتشمل إصلاح الطلبات المربوطة التي لم يُحدّث delivery_partner_invoice_id فيها
CREATE OR REPLACE FUNCTION public.link_invoice_orders_to_orders()
RETURNS TABLE(linked_count integer, updated_orders_count integer, processing_time_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_linked_count INTEGER := 0;
  v_updated_orders INTEGER := 0;
  v_fixed_orders INTEGER := 0;
  v_processing_ms INTEGER;
  v_invoice_order RECORD;
  v_matching_order RECORD;
  v_qr_id TEXT;
BEGIN
  v_start_time := clock_timestamp();
  
  -- ✅ الجزء الجديد: إصلاح الطلبات المربوطة في delivery_invoice_orders التي لم يُحدّث delivery_partner_invoice_id فيها
  UPDATE orders o
  SET 
    delivery_partner_invoice_id = di.external_id,
    updated_at = NOW()
  FROM delivery_invoice_orders dio
  JOIN delivery_invoices di ON di.id = dio.invoice_id
  WHERE dio.order_id = o.id
  AND dio.order_id IS NOT NULL
  AND (o.delivery_partner_invoice_id IS NULL OR o.delivery_partner_invoice_id = '');
  
  GET DIAGNOSTICS v_fixed_orders = ROW_COUNT;
  
  -- الجزء الأصلي: ربط الطلبات غير المربوطة
  FOR v_invoice_order IN 
    SELECT dio.id as dio_id, dio.external_order_id, dio.raw, dio.invoice_id, di.external_id as invoice_external_id
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE dio.order_id IS NULL
    LIMIT 500
  LOOP
    -- استخراج qr_id من raw data
    v_qr_id := v_invoice_order.raw->>'QRId';
    
    -- البحث عن الطلب المطابق
    SELECT id INTO v_matching_order
    FROM orders
    WHERE (
      qr_id = v_qr_id
      OR delivery_partner_order_id = v_invoice_order.external_order_id
    )
    LIMIT 1;
    
    IF v_matching_order.id IS NOT NULL THEN
      -- تحديث delivery_invoice_orders مع order_id
      UPDATE delivery_invoice_orders
      SET order_id = v_matching_order.id, updated_at = NOW()
      WHERE id = v_invoice_order.dio_id;
      
      v_linked_count := v_linked_count + 1;
      
      -- تحديث الطلب مع رقم الفاتورة
      UPDATE orders
      SET 
        delivery_partner_invoice_id = v_invoice_order.invoice_external_id,
        updated_at = NOW()
      WHERE id = v_matching_order.id
      AND (delivery_partner_invoice_id IS NULL OR delivery_partner_invoice_id = '');
      
      IF FOUND THEN
        v_updated_orders := v_updated_orders + 1;
      END IF;
    END IF;
  END LOOP;
  
  v_processing_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INTEGER;
  
  -- إرجاع النتائج (نجمع v_fixed_orders مع v_updated_orders)
  RETURN QUERY SELECT v_linked_count, (v_updated_orders + v_fixed_orders), v_processing_ms;
END;
$$;