-- ============================================
-- إصلاح جذري شامل لنظام الفواتير والتوكنات
-- ============================================

-- المرحلة 1: توحيد status_normalized إلى حروف صغيرة
UPDATE delivery_invoices 
SET status_normalized = LOWER(status_normalized)
WHERE status_normalized IS NOT NULL 
  AND status_normalized != LOWER(status_normalized);

-- المرحلة 2: إعادة بناء get_employee_invoice_stats (حسب التوكن)
DROP FUNCTION IF EXISTS get_employee_invoice_stats();

CREATE OR REPLACE FUNCTION get_employee_invoice_stats()
RETURNS TABLE (
  token_id UUID,
  employee_id UUID,
  employee_name TEXT,
  account_username TEXT,
  total_invoices BIGINT,
  received_invoices BIGINT,
  pending_invoices BIGINT,
  total_amount NUMERIC,
  received_amount NUMERIC,
  last_sync_at TIMESTAMPTZ,
  token_status TEXT,
  token_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dpt.id AS token_id,
    dpt.user_id AS employee_id,
    COALESCE(p.full_name, 'غير معروف') AS employee_name,
    COALESCE(dpt.account_username, dpt.account_label, 'حساب غير معروف') AS account_username,
    COUNT(di.id)::BIGINT AS total_invoices,
    COUNT(di.id) FILTER (WHERE LOWER(di.status_normalized) = 'received' OR di.received = true)::BIGINT AS received_invoices,
    COUNT(di.id) FILTER (WHERE LOWER(di.status_normalized) != 'received' AND di.received = false)::BIGINT AS pending_invoices,
    COALESCE(SUM(di.amount), 0)::NUMERIC AS total_amount,
    COALESCE(SUM(di.amount) FILTER (WHERE LOWER(di.status_normalized) = 'received' OR di.received = true), 0)::NUMERIC AS received_amount,
    COALESCE(MAX(di.last_synced_at), dpt.last_sync_at) AS last_sync_at,
    CASE 
      WHEN dpt.is_active AND (dpt.expires_at IS NULL OR dpt.expires_at > now()) THEN 'active'
      WHEN dpt.expires_at <= now() THEN 'expired'
      ELSE 'inactive'
    END AS token_status,
    dpt.expires_at AS token_expires_at
  FROM delivery_partner_tokens dpt
  LEFT JOIN profiles p ON p.user_id = dpt.user_id
  LEFT JOIN delivery_invoices di ON di.owner_user_id = dpt.user_id 
    AND (di.account_username = dpt.account_username OR di.account_username IS NULL)
  WHERE dpt.is_active = true
  GROUP BY dpt.id, dpt.user_id, dpt.account_username, dpt.account_label, 
           dpt.is_active, dpt.expires_at, dpt.last_sync_at, p.full_name
  ORDER BY employee_name, account_username;
END;
$$;

-- المرحلة 3: إصلاح دالة التسوية
DROP TRIGGER IF EXISTS trg_reconcile_invoice_receipts ON delivery_invoices;
DROP FUNCTION IF EXISTS reconcile_invoice_receipts_trigger();
DROP FUNCTION IF EXISTS reconcile_invoice_receipts();
DROP FUNCTION IF EXISTS reconcile_invoice_receipts(UUID);

-- دالة التسوية الرئيسية
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
  -- تحديث الطلبات المستلمة (مقارنة غير حساسة لحالة الأحرف)
  WITH received_orders AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE (LOWER(di.status_normalized) = 'received' OR di.received = true)
      AND dio.order_id IS NOT NULL
      AND (p_employee_id IS NULL OR di.owner_user_id = p_employee_id)
  )
  UPDATE orders o
  SET receipt_received = true
  FROM received_orders ro
  WHERE o.id = ro.order_id
    AND (o.receipt_received IS NULL OR o.receipt_received = false);
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- إعادة تعيين الطلبات غير المستلمة
  WITH not_received_orders AS (
    SELECT DISTINCT dio.order_id
    FROM delivery_invoice_orders dio
    JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE LOWER(di.status_normalized) != 'received' 
      AND di.received = false
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

-- دالة Trigger للتسوية التلقائية
CREATE OR REPLACE FUNCTION reconcile_invoice_receipts_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_received BOOLEAN;
BEGIN
  -- التحقق من حالة الاستلام (مقارنة غير حساسة لحالة الأحرف)
  v_is_received := (LOWER(NEW.status_normalized) = 'received' OR NEW.received = true);
  
  -- تحديث الطلبات المرتبطة
  UPDATE orders o
  SET receipt_received = v_is_received
  FROM delivery_invoice_orders dio
  WHERE dio.invoice_id = NEW.id
    AND dio.order_id = o.id
    AND (o.receipt_received IS DISTINCT FROM v_is_received);
  
  RETURN NEW;
END;
$$;

-- إنشاء Trigger
CREATE TRIGGER trg_reconcile_invoice_receipts
AFTER INSERT OR UPDATE OF status_normalized, received ON delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION reconcile_invoice_receipts_trigger();

-- المرحلة 4: إصلاح دالة get_invoice_discrepancies
DROP FUNCTION IF EXISTS get_invoice_discrepancies();

CREATE OR REPLACE FUNCTION get_invoice_discrepancies()
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  invoice_status TEXT,
  invoice_received BOOLEAN,
  order_receipt_received BOOLEAN,
  discrepancy_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id AS order_id,
    o.order_number,
    di.status_normalized AS invoice_status,
    di.received AS invoice_received,
    o.receipt_received AS order_receipt_received,
    CASE 
      WHEN (LOWER(di.status_normalized) = 'received' OR di.received = true) 
           AND (o.receipt_received IS NULL OR o.receipt_received = false)
        THEN 'invoice_received_order_not'
      WHEN LOWER(di.status_normalized) != 'received' AND di.received = false 
           AND o.receipt_received = true
        THEN 'order_received_invoice_not'
      ELSE 'unknown'
    END AS discrepancy_type
  FROM orders o
  JOIN delivery_invoice_orders dio ON dio.order_id = o.id
  JOIN delivery_invoices di ON di.id = dio.invoice_id
  WHERE (
    -- الفاتورة مستلمة لكن الطلب لا
    ((LOWER(di.status_normalized) = 'received' OR di.received = true) 
     AND (o.receipt_received IS NULL OR o.receipt_received = false))
    OR
    -- الطلب مستلم لكن الفاتورة لا
    (LOWER(di.status_normalized) != 'received' AND di.received = false 
     AND o.receipt_received = true)
  );
END;
$$;

-- تشغيل التسوية الشاملة لإصلاح التناقضات الموجودة
SELECT reconcile_invoice_receipts(NULL);

-- تحديث دالة normalize_delivery_invoice_row لتحفظ بحروف صغيرة دائماً
CREATE OR REPLACE FUNCTION normalize_delivery_invoice_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- توحيد status_normalized إلى حروف صغيرة
  IF NEW.status_normalized IS NOT NULL THEN
    NEW.status_normalized := LOWER(NEW.status_normalized);
  END IF;
  
  -- تحديث received بناءً على status_normalized
  IF NEW.status_normalized = 'received' THEN
    NEW.received := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger للتطبيع إذا لم يكن موجوداً
DROP TRIGGER IF EXISTS trg_normalize_delivery_invoice ON delivery_invoices;
CREATE TRIGGER trg_normalize_delivery_invoice
BEFORE INSERT OR UPDATE ON delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION normalize_delivery_invoice_row();