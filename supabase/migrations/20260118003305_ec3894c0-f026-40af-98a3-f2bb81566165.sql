-- 1) حذف الـ trigger أولاً
DROP TRIGGER IF EXISTS trg_reconcile_invoice_receipts ON delivery_invoices;

-- 2) حذف الدوال المكررة
DROP FUNCTION IF EXISTS reconcile_invoice_receipts();
DROP FUNCTION IF EXISTS reconcile_invoice_receipts(UUID);

-- 3) إعادة إنشاء دالة reconcile_invoice_receipts بنسخة واحدة
CREATE OR REPLACE FUNCTION reconcile_invoice_receipts(p_employee_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INT := 0;
  v_reset_count INT := 0;
BEGIN
  WITH received_orders AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE di.status_normalized = 'received'
      AND dio.order_id IS NOT NULL
      AND (p_employee_id IS NULL OR di.owner_user_id = p_employee_id)
  )
  UPDATE orders o
  SET receipt_received = true
  FROM received_orders ro
  WHERE o.id = ro.order_id
    AND o.receipt_received IS NOT TRUE;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  WITH not_received_orders AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE di.status_normalized != 'received'
      AND dio.order_id IS NOT NULL
      AND (p_employee_id IS NULL OR di.owner_user_id = p_employee_id)
  )
  UPDATE orders o
  SET receipt_received = false
  FROM not_received_orders nro
  WHERE o.id = nro.order_id
    AND o.receipt_received = true;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated_to_received', v_updated_count,
    'reset_to_not_received', v_reset_count
  );
END;
$$;

-- 4) إضافة عمود last_sync_at إذا لم يكن موجوداً
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'delivery_partner_tokens' AND column_name = 'last_sync_at'
  ) THEN
    ALTER TABLE delivery_partner_tokens ADD COLUMN last_sync_at TIMESTAMPTZ;
  END IF;
END $$;

-- 5) تحديث دالة get_employee_invoice_stats
DROP FUNCTION IF EXISTS get_employee_invoice_stats();

CREATE OR REPLACE FUNCTION get_employee_invoice_stats()
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_invoices BIGINT,
  received_invoices BIGINT,
  pending_invoices BIGINT,
  total_amount NUMERIC,
  received_amount NUMERIC,
  last_sync_at TIMESTAMPTZ,
  token_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dpt.user_id AS employee_id,
    COALESCE(p.full_name, dpt.account_username, 'غير معروف') AS employee_name,
    COUNT(di.id)::BIGINT AS total_invoices,
    COUNT(di.id) FILTER (WHERE di.status_normalized = 'received')::BIGINT AS received_invoices,
    COUNT(di.id) FILTER (WHERE di.status_normalized != 'received')::BIGINT AS pending_invoices,
    COALESCE(SUM(di.amount), 0)::NUMERIC AS total_amount,
    COALESCE(SUM(di.amount) FILTER (WHERE di.status_normalized = 'received'), 0)::NUMERIC AS received_amount,
    dpt.last_sync_at AS last_sync_at,
    CASE 
      WHEN dpt.is_active AND (dpt.expires_at IS NULL OR dpt.expires_at > now()) THEN 'active'
      WHEN dpt.expires_at <= now() THEN 'expired'
      ELSE 'inactive'
    END AS token_status
  FROM delivery_partner_tokens dpt
  LEFT JOIN profiles p ON p.user_id = dpt.user_id
  LEFT JOIN delivery_invoices di ON di.owner_user_id = dpt.user_id
  WHERE dpt.is_active = true
  GROUP BY dpt.user_id, dpt.account_username, dpt.is_active, dpt.expires_at, dpt.last_sync_at, p.full_name
  ORDER BY employee_name;
END;
$$;