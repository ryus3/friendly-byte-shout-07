-- ============================================
-- 🔧 COMPREHENSIVE FIX: Cron Jobs, Timezone, Notifications
-- ============================================

-- ========== PART 1: Cleanup duplicate/conflicting cron jobs ==========
DO $$
BEGIN
  BEGIN PERFORM cron.unschedule('smart-invoice-sync-morning'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('smart-invoice-sync-evening'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('smart-invoice-sync-am'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('smart-invoice-sync-pm'); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ========== PART 2: Drop ALL function overloads ==========
DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text, time, time);
DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text, text, text);
DROP FUNCTION IF EXISTS public.admin_manage_invoice_cron(text);
-- Drop ALL versions of update_invoice_sync_schedule to recreate fresh
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(text, text);
DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(text, text, boolean);

-- ========== PART 3: Create single unified update_invoice_sync_schedule function ==========
CREATE FUNCTION public.update_invoice_sync_schedule(
  p_morning_time TEXT,
  p_evening_time TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_morning_hour INT;
  v_evening_hour INT;
  v_morning_minute INT;
  v_evening_minute INT;
  v_morning_utc_hour INT;
  v_evening_utc_hour INT;
  v_am_cron TEXT;
  v_pm_cron TEXT;
  v_http_command TEXT;
  v_result JSONB;
BEGIN
  -- Parse Baghdad times
  v_morning_hour := SPLIT_PART(p_morning_time, ':', 1)::INT;
  v_morning_minute := COALESCE(NULLIF(SPLIT_PART(p_morning_time, ':', 2), ''), '0')::INT;
  v_evening_hour := SPLIT_PART(p_evening_time, ':', 1)::INT;
  v_evening_minute := COALESCE(NULLIF(SPLIT_PART(p_evening_time, ':', 2), ''), '0')::INT;
  
  -- Convert Baghdad (UTC+3) to UTC by SUBTRACTING 3 hours
  v_morning_utc_hour := (v_morning_hour - 3 + 24) % 24;
  v_evening_utc_hour := (v_evening_hour - 3 + 24) % 24;
  
  -- Build cron expressions (minute hour * * *)
  v_am_cron := v_morning_minute || ' ' || v_morning_utc_hour || ' * * *';
  v_pm_cron := v_evening_minute || ' ' || v_evening_utc_hour || ' * * *';
  
  RAISE NOTICE 'Timezone conversion: Baghdad % → UTC cron %', p_morning_time, v_am_cron;
  RAISE NOTICE 'Timezone conversion: Baghdad % → UTC cron %', p_evening_time, v_pm_cron;

  -- Unschedule existing jobs safely
  BEGIN PERFORM cron.unschedule('invoice-sync-am'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('invoice-sync-pm'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Build HTTP command
  v_http_command := 'SELECT net.http_post(url := current_setting(''app.settings.supabase_url'') || ''/functions/v1/smart-invoice-sync'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || current_setting(''app.settings.service_role_key'')), body := ''{"mode":"comprehensive","sync_invoices":true,"sync_orders":false,"force_refresh":false}''::jsonb)';

  -- Schedule new jobs with UTC times
  PERFORM cron.schedule('invoice-sync-am', v_am_cron, v_http_command);
  PERFORM cron.schedule('invoice-sync-pm', v_pm_cron, v_http_command);

  -- Update settings table with Baghdad times (source of truth for UI)
  INSERT INTO auto_sync_schedule_settings (id, enabled, sync_times, notifications_enabled, timezone)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    true,
    ARRAY[p_morning_time || ':00', p_evening_time || ':00'],
    true,
    'Asia/Baghdad'
  )
  ON CONFLICT (id) DO UPDATE SET
    enabled = true,
    sync_times = ARRAY[p_morning_time || ':00', p_evening_time || ':00'],
    updated_at = NOW();

  v_result := jsonb_build_object(
    'success', true,
    'morning_baghdad', p_morning_time,
    'evening_baghdad', p_evening_time,
    'morning_utc_cron', v_am_cron,
    'evening_utc_cron', v_pm_cron,
    'message', 'Schedule updated successfully'
  );

  RETURN v_result;
END;
$$;

-- ========== PART 4: Fix notification triggers ==========
DROP TRIGGER IF EXISTS trigger_notify_pending_invoice ON delivery_invoices;
DROP TRIGGER IF EXISTS trigger_notify_received_invoice ON delivery_invoices;
DROP TRIGGER IF EXISTS trigger_invoice_status_notification ON delivery_invoices;
DROP FUNCTION IF EXISTS notify_pending_invoice();
DROP FUNCTION IF EXISTS notify_received_invoice();
DROP FUNCTION IF EXISTS notify_invoice_status_change();

-- Create fixed notification function
CREATE FUNCTION notify_invoice_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := '91484496-b887-44f7-9e5d-be9db5567604';
  v_notification_type TEXT;
  v_message TEXT;
  v_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_normalized = 'pending' OR NEW.received = false THEN
      v_notification_type := 'invoice_pending';
      v_message := 'فاتورة جديدة معلقة رقم ' || COALESCE(NEW.external_id, 'غير محدد') || ' بمبلغ ' || COALESCE(NEW.amount::TEXT, '0') || ' د.ع';
    ELSE
      v_notification_type := 'invoice_received';
      v_message := 'فاتورة مستلمة رقم ' || COALESCE(NEW.external_id, 'غير محدد') || ' بمبلغ ' || COALESCE(NEW.amount::TEXT, '0') || ' د.ع';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status_normalized IS DISTINCT FROM 'received' AND NEW.status_normalized = 'received')
       OR (OLD.received IS DISTINCT FROM true AND NEW.received = true) THEN
      v_notification_type := 'invoice_received';
      v_message := 'تم استلام الفاتورة رقم ' || COALESCE(NEW.external_id, 'غير محدد') || ' بمبلغ ' || COALESCE(NEW.amount::TEXT, '0') || ' د.ع';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_data := jsonb_build_object(
    'invoice_id', NEW.id,
    'external_id', NEW.external_id,
    'amount', NEW.amount,
    'status', NEW.status,
    'status_normalized', NEW.status_normalized,
    'owner_user_id', NEW.owner_user_id
  );

  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO invoice_notifications (invoice_id, user_id, notification_type, message, data)
    VALUES (NEW.id, NEW.owner_user_id, v_notification_type, v_message, v_data)
    ON CONFLICT (invoice_id, user_id, notification_type) DO NOTHING;
  END IF;

  IF v_admin_id IS NOT NULL AND v_admin_id IS DISTINCT FROM NEW.owner_user_id THEN
    INSERT INTO invoice_notifications (invoice_id, user_id, notification_type, message, data)
    VALUES (NEW.id, v_admin_id, v_notification_type, v_message, v_data)
    ON CONFLICT (invoice_id, user_id, notification_type) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create invoice notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create unified trigger
CREATE TRIGGER trigger_invoice_status_notification
AFTER INSERT OR UPDATE OF status_normalized, received ON delivery_invoices
FOR EACH ROW
EXECUTE FUNCTION notify_invoice_status_change();

-- ========== PART 5: Apply correct schedule NOW (09:00 and 21:00 Baghdad) ==========
SELECT public.update_invoice_sync_schedule('09:00', '21:00');