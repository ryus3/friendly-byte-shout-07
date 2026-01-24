-- ✅ إعادة إنشاء دالة الجدولة مع sync_orders: true واستخدام UUID صحيح

DROP FUNCTION IF EXISTS public.update_invoice_sync_schedule(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_morning_time TEXT DEFAULT '09:00',
  p_evening_time TEXT DEFAULT '21:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_morning_hour INTEGER;
  v_morning_minute INTEGER;
  v_evening_hour INTEGER;
  v_evening_minute INTEGER;
  v_morning_utc_hour INTEGER;
  v_evening_utc_hour INTEGER;
  v_morning_cron TEXT;
  v_evening_cron TEXT;
  v_supabase_url TEXT := 'https://rqwrvkkfguoaomomvfqz.supabase.co';
  v_service_key TEXT;
  v_sql_am TEXT;
  v_sql_pm TEXT;
  v_settings_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- استخراج الساعات والدقائق
  v_morning_hour := SPLIT_PART(p_morning_time, ':', 1)::INTEGER;
  v_morning_minute := COALESCE(NULLIF(SPLIT_PART(p_morning_time, ':', 2), ''), '0')::INTEGER;
  v_evening_hour := SPLIT_PART(p_evening_time, ':', 1)::INTEGER;
  v_evening_minute := COALESCE(NULLIF(SPLIT_PART(p_evening_time, ':', 2), ''), '0')::INTEGER;
  
  -- تحويل من بغداد (UTC+3) إلى UTC (طرح 3 ساعات)
  v_morning_utc_hour := (v_morning_hour - 3 + 24) % 24;
  v_evening_utc_hour := (v_evening_hour - 3 + 24) % 24;
  
  -- بناء cron expressions
  v_morning_cron := v_morning_minute || ' ' || v_morning_utc_hour || ' * * *';
  v_evening_cron := v_evening_minute || ' ' || v_evening_utc_hour || ' * * *';
  
  -- جلب Service Key
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- إلغاء الجدولة القديمة
  BEGIN
    PERFORM cron.unschedule('invoice-sync-am');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    PERFORM cron.unschedule('invoice-sync-pm');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- بناء SQL للجدولة مع sync_orders: true
  v_sql_am := 'SELECT net.http_post(url := ''' || v_supabase_url || '/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(v_service_key, '') || '"}''::jsonb, body := ''{"mode": "comprehensive", "sync_orders": true, "force_refresh": false}''::jsonb)';
  
  v_sql_pm := 'SELECT net.http_post(url := ''' || v_supabase_url || '/functions/v1/smart-invoice-sync'', headers := ''{"Content-Type": "application/json", "Authorization": "Bearer ' || COALESCE(v_service_key, '') || '"}''::jsonb, body := ''{"mode": "comprehensive", "sync_orders": true, "force_refresh": false}''::jsonb)';
  
  -- جدولة الصباح
  PERFORM cron.schedule('invoice-sync-am', v_morning_cron, v_sql_am);
  
  -- جدولة المساء
  PERFORM cron.schedule('invoice-sync-pm', v_evening_cron, v_sql_pm);
  
  -- تحديث جدول الإعدادات (المصدر الحقيقي للتوقيت بغداد)
  UPDATE auto_sync_schedule_settings
  SET 
    enabled = true,
    sync_times = ARRAY[p_morning_time, p_evening_time],
    timezone = 'Asia/Baghdad',
    updated_at = NOW()
  WHERE id = v_settings_id;
  
  -- إذا لم يوجد سجل، أنشئ واحداً
  IF NOT FOUND THEN
    INSERT INTO auto_sync_schedule_settings (id, enabled, sync_times, timezone, updated_at)
    VALUES (v_settings_id, true, ARRAY[p_morning_time, p_evening_time], 'Asia/Baghdad', NOW());
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'morning_baghdad', p_morning_time,
    'evening_baghdad', p_evening_time,
    'morning_utc', v_morning_utc_hour || ':' || LPAD(v_morning_minute::TEXT, 2, '0'),
    'evening_utc', v_evening_utc_hour || ':' || LPAD(v_evening_minute::TEXT, 2, '0'),
    'morning_cron', v_morning_cron,
    'evening_cron', v_evening_cron
  );
END;
$func$;

-- تطبيق الجدولة الافتراضية (09:00 و 21:00 بغداد)
SELECT public.update_invoice_sync_schedule('09:00', '21:00');