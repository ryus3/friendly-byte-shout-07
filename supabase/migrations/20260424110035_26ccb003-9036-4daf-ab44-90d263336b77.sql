
-- ============================================
-- 1) تنظيف الصفوف المكررة + توحيد الجدول
-- ============================================
DELETE FROM public.auto_sync_schedule_settings 
WHERE id NOT IN (
  SELECT id FROM public.auto_sync_schedule_settings 
  ORDER BY updated_at DESC NULLS LAST 
  LIMIT 1
);

-- ============================================
-- 2) إضافة الأعمدة الجديدة للتحكم الشامل
-- ============================================
ALTER TABLE public.auto_sync_schedule_settings
  ADD COLUMN IF NOT EXISTS invoice_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_morning_time TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS invoice_evening_time TEXT NOT NULL DEFAULT '23:45',
  ADD COLUMN IF NOT EXISTS orders_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS orders_sync_times TEXT[] NOT NULL DEFAULT ARRAY['02:15','21:00']::TEXT[],
  ADD COLUMN IF NOT EXISTS orders_working_hours_only BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tokens_auto_renew_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tokens_check_time TEXT NOT NULL DEFAULT '03:00',
  ADD COLUMN IF NOT EXISTS frontend_orders_page_auto_sync BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frontend_employee_page_auto_sync BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frontend_login_sync BOOLEAN NOT NULL DEFAULT false;

-- مزامنة الأعمدة القديمة (sync_times) مع الجديدة (orders_sync_times) للحفاظ على التوافق
UPDATE public.auto_sync_schedule_settings
SET orders_sync_times = COALESCE(sync_times, ARRAY['02:15','21:00']::TEXT[])
WHERE orders_sync_times IS NULL OR array_length(orders_sync_times, 1) IS NULL;

-- ============================================
-- 3) تنظيف الكرونات الميتة + المكررة
-- ============================================
DO $$
BEGIN
  -- حذف الكرونات الميتة
  PERFORM cron.unschedule('background-sync-every-5-minutes');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('orders-sync-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- 4) تخفيض كرون التوكنات إلى مرة يومية (Lazy)
-- ============================================
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-delivery-tokens-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-delivery-tokens-daily',
  '0 0 * * *', -- 0:00 UTC = 3:00 AM Baghdad time
  $cron$
  SELECT net.http_post(
    url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/refresh-delivery-partner-tokens',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- ============================================
-- 5) RPC: تحديث جدولة مزامنة الطلبات
-- ============================================
CREATE OR REPLACE FUNCTION public.update_orders_sync_schedule(
  p_times TEXT[] DEFAULT ARRAY['02:15','21:00']::TEXT[],
  p_enabled BOOLEAN DEFAULT true,
  p_working_hours_only BOOLEAN DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role TEXT;
  v_id UUID;
  v_normalized_times TEXT[];
  v_t TEXT;
BEGIN
  -- التحقق من الصلاحية
  SELECT role INTO v_user_role 
  FROM public.profiles 
  WHERE user_id = auth.uid();

  IF v_user_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'غير مصرح: المدير فقط يمكنه تعديل جدولة الطلبات';
  END IF;

  -- التحقق من عدد الأوقات (1-4)
  IF array_length(p_times, 1) IS NULL OR array_length(p_times, 1) < 1 OR array_length(p_times, 1) > 4 THEN
    RAISE EXCEPTION 'عدد الأوقات يجب أن يكون بين 1 و 4';
  END IF;

  -- تطبيع الأوقات إلى صيغة HH:MM (بدون ثواني)
  v_normalized_times := ARRAY[]::TEXT[];
  FOREACH v_t IN ARRAY p_times LOOP
    v_normalized_times := array_append(
      v_normalized_times,
      TO_CHAR((v_t::TIME), 'HH24:MI')
    );
  END LOOP;

  -- تحديث الإعدادات
  UPDATE public.auto_sync_schedule_settings
  SET 
    orders_sync_enabled = p_enabled,
    orders_sync_times = v_normalized_times,
    orders_working_hours_only = p_working_hours_only,
    sync_times = v_normalized_times, -- توافق مع check_and_run_sync
    enabled = p_enabled, -- توافق مع check_and_run_sync
    updated_at = NOW()
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO public.auto_sync_schedule_settings (
      orders_sync_enabled, orders_sync_times, orders_working_hours_only,
      sync_times, enabled
    ) VALUES (
      p_enabled, v_normalized_times, p_working_hours_only,
      v_normalized_times, p_enabled
    ) RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'times', v_normalized_times,
    'working_hours_only', p_working_hours_only
  );
END;
$$;

-- ============================================
-- 6) RPC: تحديث إعدادات تجديد التوكنات
-- ============================================
CREATE OR REPLACE FUNCTION public.update_tokens_renewal_settings(
  p_enabled BOOLEAN DEFAULT true,
  p_check_time TEXT DEFAULT '03:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'net'
AS $$
DECLARE
  v_user_role TEXT;
  v_hour INT;
  v_minute INT;
  v_utc_hour INT;
  v_cron_expr TEXT;
BEGIN
  SELECT role INTO v_user_role 
  FROM public.profiles 
  WHERE user_id = auth.uid();

  IF v_user_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'غير مصرح: المدير فقط يمكنه تعديل جدولة التوكنات';
  END IF;

  -- تحديث الإعدادات في الجدول
  UPDATE public.auto_sync_schedule_settings
  SET 
    tokens_auto_renew_enabled = p_enabled,
    tokens_check_time = TO_CHAR(p_check_time::TIME, 'HH24:MI'),
    updated_at = NOW();

  -- إزالة الكرون القديم
  BEGIN
    PERFORM cron.unschedule('refresh-delivery-tokens-daily');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- إنشاء كرون جديد فقط إذا كان مفعّلاً
  IF p_enabled THEN
    v_hour := EXTRACT(HOUR FROM p_check_time::TIME);
    v_minute := EXTRACT(MINUTE FROM p_check_time::TIME);
    -- تحويل من بغداد (UTC+3) إلى UTC
    v_utc_hour := (v_hour - 3 + 24) % 24;
    v_cron_expr := v_minute || ' ' || v_utc_hour || ' * * *';

    PERFORM cron.schedule(
      'refresh-delivery-tokens-daily',
      v_cron_expr,
      $cmd$
      SELECT net.http_post(
        url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/refresh-delivery-partner-tokens',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;
      $cmd$
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'check_time_baghdad', TO_CHAR(p_check_time::TIME, 'HH24:MI'),
    'cron_expression_utc', CASE WHEN p_enabled THEN v_cron_expr ELSE NULL END
  );
END;
$$;

-- ============================================
-- 7) RPC: تحديث إعدادات الواجهة (frontend toggles)
-- ============================================
CREATE OR REPLACE FUNCTION public.update_frontend_sync_settings(
  p_orders_page_auto_sync BOOLEAN DEFAULT true,
  p_employee_page_auto_sync BOOLEAN DEFAULT true,
  p_login_sync BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  SELECT role INTO v_user_role 
  FROM public.profiles 
  WHERE user_id = auth.uid();

  IF v_user_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  UPDATE public.auto_sync_schedule_settings
  SET 
    frontend_orders_page_auto_sync = p_orders_page_auto_sync,
    frontend_employee_page_auto_sync = p_employee_page_auto_sync,
    frontend_login_sync = p_login_sync,
    updated_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 8) RPC: قراءة الإعدادات الموحّدة + حالة الكرونات
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unified_sync_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $$
DECLARE
  v_settings RECORD;
  v_crons jsonb;
BEGIN
  SELECT * INTO v_settings 
  FROM public.auto_sync_schedule_settings 
  ORDER BY updated_at DESC NULLS LAST 
  LIMIT 1;

  -- جلب حالة الكرونات الفاعلة
  SELECT jsonb_agg(jsonb_build_object(
    'jobname', jobname,
    'schedule', schedule,
    'active', active
  )) INTO v_crons
  FROM cron.job
  WHERE jobname IN (
    'smart-invoice-sync-morning',
    'smart-invoice-sync-evening',
    'sync-order-updates-scheduled',
    'refresh-delivery-tokens-daily'
  );

  RETURN jsonb_build_object(
    'invoice_sync_enabled', COALESCE(v_settings.invoice_sync_enabled, true),
    'invoice_morning_time', COALESCE(v_settings.invoice_morning_time, '09:00'),
    'invoice_evening_time', COALESCE(v_settings.invoice_evening_time, '23:45'),
    'orders_sync_enabled', COALESCE(v_settings.orders_sync_enabled, true),
    'orders_sync_times', COALESCE(v_settings.orders_sync_times, ARRAY['02:15','21:00']::TEXT[]),
    'orders_working_hours_only', COALESCE(v_settings.orders_working_hours_only, true),
    'tokens_auto_renew_enabled', COALESCE(v_settings.tokens_auto_renew_enabled, true),
    'tokens_check_time', COALESCE(v_settings.tokens_check_time, '03:00'),
    'frontend_orders_page_auto_sync', COALESCE(v_settings.frontend_orders_page_auto_sync, true),
    'frontend_employee_page_auto_sync', COALESCE(v_settings.frontend_employee_page_auto_sync, true),
    'frontend_login_sync', COALESCE(v_settings.frontend_login_sync, false),
    'notifications_enabled', COALESCE(v_settings.notifications_enabled, true),
    'last_run_at', v_settings.last_run_at,
    'updated_at', v_settings.updated_at,
    'active_crons', COALESCE(v_crons, '[]'::jsonb)
  );
END;
$$;

-- ============================================
-- 9) تحديث check_and_run_sync لاحترام orders_working_hours_only
-- ============================================
CREATE OR REPLACE FUNCTION public.check_and_run_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  current_time_text TEXT;
  current_hour_baghdad INT;
BEGIN
  SELECT * INTO s FROM public.auto_sync_schedule_settings 
  ORDER BY updated_at DESC NULLS LAST LIMIT 1;
  
  -- فحص التفعيل (يدعم العمود القديم enabled والجديد orders_sync_enabled)
  IF NOT COALESCE(s.orders_sync_enabled, s.enabled, false) THEN
    RETURN;
  END IF;

  -- وقت بغداد الحالي
  current_time_text := TO_CHAR(NOW() AT TIME ZONE 'Asia/Baghdad', 'HH24:MI');
  current_hour_baghdad := EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Baghdad');

  -- احترام ساعات العمل (8ص-8م) إن كان مُفعّلاً
  IF COALESCE(s.orders_working_hours_only, true) AND (current_hour_baghdad < 8 OR current_hour_baghdad >= 20) THEN
    RETURN;
  END IF;

  -- مطابقة الوقت مع orders_sync_times (أو sync_times للتوافق)
  IF COALESCE(s.orders_sync_times, s.sync_times, ARRAY[]::TEXT[]) @> ARRAY[current_time_text]::TEXT[] THEN
    PERFORM net.http_post(
      url := 'https://tkheostkubborwkwzugl.supabase.co/functions/v1/sync-order-updates',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA"}'::jsonb,
      body := '{}'::jsonb
    );

    UPDATE public.auto_sync_schedule_settings
    SET last_run_at = NOW();
  END IF;
END;
$function$;

-- ============================================
-- 10) صلاحيات تنفيذ الـRPCs
-- ============================================
GRANT EXECUTE ON FUNCTION public.update_orders_sync_schedule(TEXT[], BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tokens_renewal_settings(BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_frontend_sync_settings(BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_sync_settings() TO authenticated;
