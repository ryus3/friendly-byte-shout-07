-- إصلاح دالة تغيير الوقت (تحفظ الإعدادات فقط بدون إدارة cron)
CREATE OR REPLACE FUNCTION public.update_invoice_sync_schedule(
  p_enabled boolean DEFAULT true,
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
  v_settings_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_morning_hour int;
  v_morning_minute int;
  v_evening_hour int;
  v_evening_minute int;
  v_morning_cron text;
  v_evening_cron text;
BEGIN
  -- استخراج الساعات والدقائق
  v_morning_hour := EXTRACT(HOUR FROM p_morning_time)::int;
  v_morning_minute := EXTRACT(MINUTE FROM p_morning_time)::int;
  v_evening_hour := EXTRACT(HOUR FROM p_evening_time)::int;
  v_evening_minute := EXTRACT(MINUTE FROM p_evening_time)::int;
  
  -- بناء cron expressions للعرض
  v_morning_cron := v_morning_minute || ' ' || v_morning_hour || ' * * *';
  v_evening_cron := v_evening_minute || ' ' || v_evening_hour || ' * * *';

  -- تحديث جدول الإعدادات فقط
  INSERT INTO invoice_sync_settings (id, daily_sync_enabled, sync_frequency, morning_sync_time, evening_sync_time, updated_at)
  VALUES (v_settings_id, p_enabled, p_frequency, p_morning_time, p_evening_time, NOW())
  ON CONFLICT (id) DO UPDATE SET
    daily_sync_enabled = EXCLUDED.daily_sync_enabled,
    sync_frequency = EXCLUDED.sync_frequency,
    morning_sync_time = EXCLUDED.morning_sync_time,
    evening_sync_time = EXCLUDED.evening_sync_time,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'enabled', p_enabled,
    'frequency', p_frequency,
    'morning_time', p_morning_time::text,
    'evening_time', p_evening_time::text,
    'morning_cron', v_morning_cron,
    'evening_cron', v_evening_cron,
    'note', 'Settings saved. Cron jobs must be managed in Supabase Dashboard.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;