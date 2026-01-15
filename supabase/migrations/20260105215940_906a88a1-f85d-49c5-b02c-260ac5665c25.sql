-- ============================================
-- 🔄 Database Functions for Invoice Sync Control
-- ============================================

-- 1. ✅ Function لتسوية التناقضات (Reconciliation)
-- إصلاح الطلبات المرتبطة بفواتير مستلمة لكن receipt_received=false
CREATE OR REPLACE FUNCTION reconcile_invoice_receipts()
RETURNS TABLE(order_id uuid, invoice_id uuid, fixed boolean) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  fixed_count integer := 0;
BEGIN
  -- البحث عن التناقضات وإصلاحها
  FOR rec IN 
    SELECT 
      o.id as order_id,
      di.id as invoice_id,
      di.received_at as invoice_received_at
    FROM orders o
    INNER JOIN delivery_invoice_orders dio ON dio.order_id = o.id
    INNER JOIN delivery_invoices di ON di.id = dio.invoice_id
    WHERE di.received = true 
      AND (o.receipt_received = false OR o.receipt_received IS NULL)
  LOOP
    -- تحديث الطلب
    UPDATE orders 
    SET 
      receipt_received = true,
      receipt_received_at = COALESCE(rec.invoice_received_at, NOW()),
      updated_at = NOW()
    WHERE id = rec.order_id;
    
    fixed_count := fixed_count + 1;
    
    RETURN QUERY SELECT rec.order_id, rec.invoice_id, true;
  END LOOP;
  
  -- تسجيل في logs
  IF fixed_count > 0 THEN
    INSERT INTO background_sync_logs (sync_type, success, orders_updated)
    VALUES ('reconciliation', true, fixed_count);
  END IF;
  
  RETURN;
END;
$$;

-- 2. ✅ Function للحصول على إحصائيات الفواتير
CREATE OR REPLACE FUNCTION get_invoice_sync_stats()
RETURNS TABLE(
  total_invoices bigint,
  received_invoices bigint,
  pending_invoices bigint,
  total_linked_orders bigint,
  orders_awaiting_receipt bigint,
  last_sync_at timestamptz,
  last_sync_success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM delivery_invoices)::bigint as total_invoices,
    (SELECT COUNT(*) FROM delivery_invoices WHERE received = true)::bigint as received_invoices,
    (SELECT COUNT(*) FROM delivery_invoices WHERE received = false OR received IS NULL)::bigint as pending_invoices,
    (SELECT COUNT(*) FROM delivery_invoice_orders WHERE order_id IS NOT NULL)::bigint as total_linked_orders,
    (
      SELECT COUNT(*) FROM orders o
      INNER JOIN delivery_invoice_orders dio ON dio.order_id = o.id
      INNER JOIN delivery_invoices di ON di.id = dio.invoice_id
      WHERE di.received = true AND (o.receipt_received = false OR o.receipt_received IS NULL)
    )::bigint as orders_awaiting_receipt,
    (SELECT MAX(sync_time) FROM background_sync_logs WHERE sync_type LIKE '%invoice%')::timestamptz as last_sync_at,
    (SELECT success FROM background_sync_logs WHERE sync_type LIKE '%invoice%' ORDER BY sync_time DESC LIMIT 1)::boolean as last_sync_success;
END;
$$;

-- 3. ✅ Function للحصول على حالة Cron Jobs
CREATE OR REPLACE FUNCTION get_invoice_cron_status()
RETURNS TABLE(
  job_name text,
  schedule text,
  is_active boolean,
  next_run_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::text as job_name,
    j.schedule::text as schedule,
    j.active as is_active,
    -- تقدير وقت التشغيل القادم (تقريبي)
    CASE 
      WHEN j.active THEN NOW() + INTERVAL '1 hour'
      ELSE NULL
    END as next_run_at
  FROM cron.job j
  WHERE j.jobname LIKE '%invoice%' OR j.jobname LIKE '%smart%'
  ORDER BY j.jobname;
END;
$$;

-- 4. ✅ Function لتحديث جدولة المزامنة
CREATE OR REPLACE FUNCTION update_invoice_sync_schedule(
  p_enabled boolean,
  p_frequency text DEFAULT 'twice_daily',
  p_morning_time time DEFAULT '09:00:00',
  p_evening_time time DEFAULT '21:00:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  morning_hour integer;
  evening_hour integer;
  result jsonb;
BEGIN
  morning_hour := EXTRACT(HOUR FROM p_morning_time)::integer;
  evening_hour := EXTRACT(HOUR FROM p_evening_time)::integer;
  
  -- تعطيل جميع الـ jobs القديمة المتضاربة
  UPDATE cron.job SET active = false
  WHERE jobname IN (
    'auto-sync-invoices-morning',
    'auto-sync-invoices-evening',
    'invoices-daily-sync',
    'daily-alwaseet-sync'
  );
  
  IF p_enabled THEN
    -- تفعيل الـ jobs الذكية
    IF p_frequency = 'twice_daily' THEN
      -- تحديث morning job
      UPDATE cron.job 
      SET schedule = format('0 %s * * *', morning_hour), active = true
      WHERE jobname = 'smart-invoice-sync-morning';
      
      -- تحديث evening job
      UPDATE cron.job 
      SET schedule = format('0 %s * * *', evening_hour), active = true
      WHERE jobname = 'smart-invoice-sync-evening';
    ELSE
      -- مرة واحدة يومياً (morning فقط)
      UPDATE cron.job 
      SET schedule = format('0 %s * * *', morning_hour), active = true
      WHERE jobname = 'smart-invoice-sync-morning';
      
      UPDATE cron.job SET active = false
      WHERE jobname = 'smart-invoice-sync-evening';
    END IF;
  ELSE
    -- تعطيل الكل
    UPDATE cron.job SET active = false
    WHERE jobname LIKE 'smart-invoice-sync%';
  END IF;
  
  -- تحديث إعدادات invoice_sync_settings
  INSERT INTO invoice_sync_settings (
    id, 
    daily_sync_enabled, 
    sync_frequency, 
    morning_sync_time, 
    evening_sync_time,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    p_enabled,
    p_frequency,
    p_morning_time::text,
    p_evening_time::text,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    daily_sync_enabled = EXCLUDED.daily_sync_enabled,
    sync_frequency = EXCLUDED.sync_frequency,
    morning_sync_time = EXCLUDED.morning_sync_time,
    evening_sync_time = EXCLUDED.evening_sync_time,
    updated_at = NOW();
  
  result := jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'frequency', p_frequency,
    'morning_time', p_morning_time::text,
    'evening_time', p_evening_time::text
  );
  
  RETURN result;
END;
$$;

-- 5. ✅ Function للحصول على سجل المزامنة الأخير
CREATE OR REPLACE FUNCTION get_recent_sync_logs(p_limit integer DEFAULT 10)
RETURNS TABLE(
  id uuid,
  sync_type text,
  success boolean,
  invoices_synced integer,
  orders_updated integer,
  sync_time timestamptz,
  error_message text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    sync_type,
    success,
    invoices_synced,
    orders_updated,
    sync_time,
    error_message
  FROM background_sync_logs
  WHERE sync_type LIKE '%invoice%' OR sync_type LIKE '%reconcil%'
  ORDER BY sync_time DESC
  LIMIT p_limit;
$$;

-- 6. ✅ Function للحصول على تفاصيل الموظفين وفواتيرهم
CREATE OR REPLACE FUNCTION get_employee_invoice_stats()
RETURNS TABLE(
  employee_id uuid,
  employee_name text,
  account_username text,
  total_invoices bigint,
  received_invoices bigint,
  pending_invoices bigint,
  total_amount numeric,
  last_sync_at timestamptz,
  token_active boolean,
  token_expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id as employee_id,
    p.full_name as employee_name,
    dpt.account_username,
    COUNT(di.id)::bigint as total_invoices,
    COUNT(CASE WHEN di.received = true THEN 1 END)::bigint as received_invoices,
    COUNT(CASE WHEN di.received = false OR di.received IS NULL THEN 1 END)::bigint as pending_invoices,
    COALESCE(SUM(di.amount), 0) as total_amount,
    MAX(di.last_synced_at) as last_sync_at,
    dpt.is_active as token_active,
    dpt.expires_at as token_expires_at
  FROM profiles p
  LEFT JOIN delivery_partner_tokens dpt ON dpt.user_id = p.user_id AND dpt.partner_name = 'alwaseet'
  LEFT JOIN delivery_invoices di ON di.owner_user_id = p.user_id
  WHERE dpt.id IS NOT NULL
  GROUP BY p.user_id, p.full_name, dpt.account_username, dpt.is_active, dpt.expires_at
  ORDER BY total_invoices DESC;
$$;

-- 7. ✅ Function للكشف عن التناقضات
CREATE OR REPLACE FUNCTION get_invoice_discrepancies()
RETURNS TABLE(
  discrepancy_type text,
  count bigint,
  details text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- التناقض 1: طلبات مرتبطة بفواتير مستلمة لكن لم تُعلَّم
  SELECT 
    'orders_not_marked_received'::text as discrepancy_type,
    COUNT(*)::bigint as count,
    'طلبات مرتبطة بفواتير مستلمة لكن receipt_received=false'::text as details
  FROM orders o
  INNER JOIN delivery_invoice_orders dio ON dio.order_id = o.id
  INNER JOIN delivery_invoices di ON di.id = dio.invoice_id
  WHERE di.received = true AND (o.receipt_received = false OR o.receipt_received IS NULL)
  
  UNION ALL
  
  -- التناقض 2: فواتير بحالة "تاجر" لكن received=false
  SELECT 
    'invoices_status_mismatch'::text as discrepancy_type,
    COUNT(*)::bigint as count,
    'فواتير بحالة "التاجر" لكن received=false'::text as details
  FROM delivery_invoices
  WHERE (status LIKE '%التاجر%' OR status LIKE '%تاجر%') 
    AND (received = false OR received IS NULL)
  
  UNION ALL
  
  -- التناقض 3: طلبات بدون ربط رغم وجود فواتير
  SELECT 
    'unlinked_invoice_orders'::text as discrepancy_type,
    COUNT(*)::bigint as count,
    'طلبات فواتير بدون ربط بالطلبات المحلية'::text as details
  FROM delivery_invoice_orders
  WHERE order_id IS NULL;
$$;

-- 8. ✅ إصلاح الفواتير بحالة "التاجر" لكن received=false
CREATE OR REPLACE FUNCTION fix_merchant_received_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fixed_count integer := 0;
BEGIN
  UPDATE delivery_invoices
  SET 
    received = true,
    received_flag = true,
    status_normalized = 'received',
    received_at = COALESCE(received_at, last_api_updated_at, updated_at, NOW())
  WHERE (status LIKE '%التاجر%' OR status LIKE '%تاجر%' OR status LIKE '%مستلم%')
    AND (received = false OR received IS NULL);
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  
  -- تسجيل في logs
  IF fixed_count > 0 THEN
    INSERT INTO background_sync_logs (sync_type, success, invoices_synced)
    VALUES ('fix_merchant_invoices', true, fixed_count);
  END IF;
  
  RETURN fixed_count;
END;
$$;

-- منح الصلاحيات للمستخدمين المصرح لهم
GRANT EXECUTE ON FUNCTION reconcile_invoice_receipts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_sync_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_cron_status() TO authenticated;
GRANT EXECUTE ON FUNCTION update_invoice_sync_schedule(boolean, text, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_sync_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_employee_invoice_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_invoice_discrepancies() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_merchant_received_invoices() TO authenticated;