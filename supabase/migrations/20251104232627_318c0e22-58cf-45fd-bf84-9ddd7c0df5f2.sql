-- المرحلة 1: إصلاح دالة sync_recent_received_invoices لربط طلبات المدير والموظف
-- إزالة شرط created_by = owner_user_id لربط جميع الطلبات المرتبطة بالفاتورة

CREATE OR REPLACE FUNCTION sync_recent_received_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer := 0;
  rows_affected integer;
  invoice_record record;
BEGIN
  -- جلب الفواتير المستلمة التي لم يتم ربطها بالكامل
  FOR invoice_record IN 
    SELECT 
      di.id,
      di.external_id,
      di.partner,
      di.owner_user_id
    FROM delivery_invoices di
    WHERE di.received = true
      AND di.received_flag = true
      AND di.created_at >= NOW() - INTERVAL '30 days'
    ORDER BY di.received_at DESC
    LIMIT 100
  LOOP
    -- ربط الطلبات بالفواتير عبر delivery_invoice_orders
    -- ✅ إزالة شرط created_by لربط طلبات المدير والموظف
    UPDATE orders o
    SET 
      delivery_partner_invoice_id = invoice_record.external_id,
      receipt_received = true,
      receipt_received_at = COALESCE(o.receipt_received_at, NOW()),
      status = CASE 
        WHEN o.status = 'delivered' THEN 'completed'
        ELSE o.status
      END,
      updated_at = NOW()
    WHERE o.id IN (
      SELECT dio.order_id
      FROM delivery_invoice_orders dio
      WHERE dio.invoice_id = invoice_record.id
        AND dio.order_id IS NOT NULL
    )
    AND o.receipt_received = false
    AND o.delivery_partner = invoice_record.partner;
    
    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    updated_count := updated_count + rows_affected;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_orders_count', updated_count,
    'message', format('تم تحديث %s طلب من الفواتير المستلمة', updated_count)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'updated_orders_count', 0
  );
END;
$$;