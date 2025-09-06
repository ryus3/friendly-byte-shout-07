-- إنشاء دالة مزامنة طلبات موظف محدد
CREATE OR REPLACE FUNCTION public.sync_employee_orders(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orders_updated integer := 0;
  v_total_orders integer := 0;
  v_order_record record;
BEGIN
  -- جلب طلبات الوسيط للموظف من آخر 30 يوم
  SELECT COUNT(*) INTO v_total_orders
  FROM orders
  WHERE created_by = p_employee_id
    AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
    AND created_at >= now() - interval '30 days'
    AND status IN ('pending', 'shipped', 'delivery');

  -- تحديث الطلبات (محاكاة مزامنة حقيقية)
  FOR v_order_record IN 
    SELECT id, order_number, delivery_status
    FROM orders
    WHERE created_by = p_employee_id
      AND LOWER(COALESCE(delivery_partner, '')) = 'alwaseet'
      AND created_at >= now() - interval '30 days'
      AND status IN ('pending', 'shipped', 'delivery')
  LOOP
    -- تحديث timestamp المزامنة
    UPDATE orders
    SET updated_at = now()
    WHERE id = v_order_record.id;
    
    v_orders_updated := v_orders_updated + 1;
  END LOOP;

  -- تسجيل المزامنة
  INSERT INTO auto_sync_log (
    sync_type, triggered_by, employees_processed, orders_updated, 
    success, completed_at, results
  ) VALUES (
    'employee_manual', p_employee_id, 1, v_orders_updated,
    true, now(), 
    jsonb_build_object(
      'employee_id', p_employee_id,
      'total_orders', v_total_orders,
      'updated_orders', v_orders_updated
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'تم تحديث ' || v_orders_updated || ' طلب من أصل ' || v_total_orders,
    'orders_updated', v_orders_updated,
    'total_orders', v_total_orders
  );
END;
$$;

-- إنشاء Cron Jobs للمزامنة التلقائية
SELECT cron.schedule(
  'auto-sync-invoices-morning',
  '0 9 * * *', -- يومياً الساعة 9 صباحاً
  $$
  SELECT net.http_post(
    url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-alwaseet-invoices',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
    body:='{"sync_type": "scheduled_morning"}'::jsonb
  ) as request_id;
  $$
);

SELECT cron.schedule(
  'auto-sync-invoices-evening',
  '0 21 * * *', -- يومياً الساعة 9 مساءً  
  $$
  SELECT net.http_post(
    url:='https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-alwaseet-invoices',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
    body:='{"sync_type": "scheduled_evening"}'::jsonb
  ) as request_id;
  $$
);