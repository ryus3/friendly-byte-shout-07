-- =====================================================
-- إرجاع النظام كما كان قبل التعديل الأخير
-- =====================================================

-- 1) حذف الـ Trigger الحالي إن وجد
DROP TRIGGER IF EXISTS trg_reconcile_invoice_receipts ON delivery_invoices;

-- 2) حذف الدالة الحالية الخاطئة
DROP FUNCTION IF EXISTS reconcile_invoice_receipts(UUID);
DROP FUNCTION IF EXISTS reconcile_invoice_receipts();

-- 3) إعادة إنشاء دالة reconcile_invoice_receipts الأصلية (RETURNS trigger)
-- مع المنطق الصحيح: Active Reset + Eligible Marking
CREATE OR REPLACE FUNCTION reconcile_invoice_receipts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_id UUID;
  v_is_received BOOLEAN;
BEGIN
  v_invoice_id := NEW.id;
  v_is_received := (NEW.status_normalized = 'received' OR NEW.received = true);

  IF v_is_received THEN
    -- الفاتورة مستلمة: نحدث الطلبات المؤهلة فقط
    UPDATE orders o
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(NEW.received_at, now())
    FROM delivery_invoice_orders dio
    WHERE dio.invoice_id = v_invoice_id
      AND dio.order_id = o.id
      AND o.receipt_received IS NOT TRUE
      -- فقط الطلبات المؤهلة (مسلمة/مكتملة/تسليم جزئي)
      AND (
        o.status IN ('delivered', 'completed', 'partial_delivery')
        OR o.delivery_status IN ('4', '5', '21')
      )
      -- استبعاد المرتجعات
      AND o.status NOT IN ('returned', 'rejected', 'cancelled')
      AND COALESCE(o.delivery_status, '') != '17';
  ELSE
    -- الفاتورة غير مستلمة: لا نفعل شيء للطلبات المرتبطة
    -- (لا نصفّر receipt_received لأن هذا قد يسبب مشاكل)
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 4) إعادة إنشاء الـ Trigger على delivery_invoices
CREATE TRIGGER trg_reconcile_invoice_receipts
  AFTER UPDATE ON delivery_invoices
  FOR EACH ROW
  EXECUTE FUNCTION reconcile_invoice_receipts();

-- 5) حذف الدوال المكررة لـ update_invoice_sync_schedule
DROP FUNCTION IF EXISTS update_invoice_sync_schedule(BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_invoice_sync_schedule(BOOLEAN, TIME, TIME, TEXT);

-- 6) إعادة إنشاء update_invoice_sync_schedule بنسخة واحدة تقبل TEXT
CREATE OR REPLACE FUNCTION update_invoice_sync_schedule(
  p_enabled BOOLEAN,
  p_morning_time TEXT,
  p_evening_time TEXT,
  p_frequency TEXT DEFAULT 'twice_daily'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO invoice_sync_settings (
    id, 
    sync_enabled, 
    morning_sync_time, 
    evening_sync_time, 
    sync_frequency,
    updated_at
  )
  VALUES (
    'default',
    p_enabled,
    p_morning_time::TIME,
    p_evening_time::TIME,
    p_frequency,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    sync_enabled = EXCLUDED.sync_enabled,
    morning_sync_time = EXCLUDED.morning_sync_time,
    evening_sync_time = EXCLUDED.evening_sync_time,
    sync_frequency = EXCLUDED.sync_frequency,
    updated_at = now();
  
  RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$;

-- 7) إرجاع دالة get_employee_invoice_stats الأصلية
DROP FUNCTION IF EXISTS get_employee_invoice_stats();

CREATE OR REPLACE FUNCTION get_employee_invoice_stats()
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  account_username TEXT,
  total_invoices BIGINT,
  received_invoices BIGINT,
  pending_invoices BIGINT,
  total_amount NUMERIC,
  received_amount NUMERIC,
  last_sync_at TIMESTAMPTZ,
  token_active BOOLEAN,
  token_expires_at TIMESTAMPTZ
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
    dpt.account_username AS account_username,
    COUNT(di.id)::BIGINT AS total_invoices,
    COUNT(di.id) FILTER (WHERE di.status_normalized = 'received')::BIGINT AS received_invoices,
    COUNT(di.id) FILTER (WHERE di.status_normalized != 'received')::BIGINT AS pending_invoices,
    COALESCE(SUM(di.amount), 0)::NUMERIC AS total_amount,
    COALESCE(SUM(di.amount) FILTER (WHERE di.status_normalized = 'received'), 0)::NUMERIC AS received_amount,
    MAX(di.last_synced_at) AS last_sync_at,
    dpt.is_active AS token_active,
    dpt.expires_at AS token_expires_at
  FROM delivery_partner_tokens dpt
  LEFT JOIN profiles p ON p.user_id = dpt.user_id
  LEFT JOIN delivery_invoices di ON di.owner_user_id = dpt.user_id
  WHERE dpt.is_active = true
  GROUP BY dpt.user_id, dpt.account_username, dpt.is_active, dpt.expires_at, p.full_name
  ORDER BY employee_name;
END;
$$;

-- 8) تشغيل تسوية شاملة لمرة واحدة لتصحيح الحالات المتضررة
-- تحديث الطلبات المرتبطة بفواتير مستلمة
UPDATE orders o
SET 
  receipt_received = true,
  receipt_received_at = COALESCE(di.received_at, di.updated_at)
FROM delivery_invoice_orders dio
JOIN delivery_invoices di ON di.id = dio.invoice_id
WHERE dio.order_id = o.id
  AND di.status_normalized = 'received'
  AND o.receipt_received IS NOT TRUE
  AND (
    o.status IN ('delivered', 'completed', 'partial_delivery')
    OR o.delivery_status IN ('4', '5', '21')
  )
  AND o.status NOT IN ('returned', 'rejected', 'cancelled')
  AND COALESCE(o.delivery_status, '') != '17';