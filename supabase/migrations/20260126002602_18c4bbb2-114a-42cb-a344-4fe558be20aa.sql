
-- تعديل الـ trigger لاستخدام owner_user_id من الفاتورة كـ fallback عند عدم وجود receipt_received_by
-- هذا يضمن أن الحركات المالية تُنشأ بشكل صحيح حتى عند الربط التلقائي

CREATE OR REPLACE FUNCTION public.auto_link_dio_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_received_at timestamptz;
  v_owner_user_id uuid;
BEGIN
  -- إذا order_id موجود مسبقاً، لا داعي للبحث
  IF NEW.order_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- البحث عن الطلب المحلي بـ tracking number
  SELECT id INTO v_order_id
  FROM orders
  WHERE tracking_number = NEW.external_order_id
    AND status IN ('delivered', 'completed', 'partial_delivery')
    AND delivery_status IN ('4', '5', '21')
  LIMIT 1;

  IF v_order_id IS NOT NULL THEN
    NEW.order_id := v_order_id;
    
    -- جلب تاريخ استلام الفاتورة و owner_user_id
    SELECT received_at, owner_user_id 
    INTO v_received_at, v_owner_user_id
    FROM delivery_invoices 
    WHERE id = NEW.invoice_id;
    
    -- تحديث الطلب مع استخدام owner_user_id كـ receipt_received_by
    UPDATE orders
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(receipt_received_at, v_received_at, now()),
      receipt_received_by = COALESCE(receipt_received_by, v_owner_user_id),
      delivery_partner_invoice_id = (SELECT external_id FROM delivery_invoices WHERE id = NEW.invoice_id)
    WHERE id = NEW.order_id
      AND (receipt_received IS NULL OR receipt_received = false);
  END IF;

  RETURN NEW;
END;
$$;
